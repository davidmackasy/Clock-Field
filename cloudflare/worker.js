import { Container, getContainer } from "@cloudflare/containers";

const secretNames = ["DATABASE_URL", "SESSION_SECRET", "SUPABASE_STORAGE_KEY", "MAILGUN_API_KEY", "MAILGUN_DOMAIN", "MAIL_FROM", "OPENAI_API_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_STARTER_MONTHLY", "STRIPE_PRICE_STARTER_YEARLY", "STRIPE_PRICE_GROWTH_MONTHLY", "STRIPE_PRICE_GROWTH_YEARLY", "STRIPE_PRICE_PRO_MONTHLY", "STRIPE_PRICE_PRO_YEARLY"];

export class ClockFieldContainer extends Container {
  defaultPort = 8080;
  sleepAfter = "1h";
  enableInternet = true;

  async getPayrollSchedules() {
    if(!await this.ctx.storage.get("payrollSchedulesInitialized"))return undefined;
    return await this.ctx.storage.get("payrollSchedules");
  }

  async fetch(request) {
    const envVars = {
      NODE_ENV: "production", PORT: "8080", DATA_DIR: "/tmp/clockfield", TRUST_PROXY: "1",
      DATABASE_SSL_CA_PATH: "/app/config/supabase-ca.crt",
      SUPABASE_URL: "https://zjjbnwupttziohqpyyfl.supabase.co",
      SUPABASE_STORAGE_BUCKET: "clockfield-migration",
      APP_URL: this.env.APP_URL || new URL(request.url).origin,
      APP_BASE_URL: this.env.APP_URL || new URL(request.url).origin,
      APP_DEPLOYMENT_REVISION: request.headers.get("X-ClockField-Deployment-Revision") || this.env.CF_VERSION_METADATA?.id || "local",
    };
    for (const name of secretNames) if (this.env[name]) envVars[name] = this.env[name];
    if (!envVars.DATABASE_URL || !envVars.SESSION_SECRET || !envVars.SUPABASE_STORAGE_KEY) {
      return new Response("ClockField deployment configuration is incomplete", { status: 503 });
    }
    // Running containers retain their startup environment across Worker deployments.
    // Restart for configuration or version changes so secrets and app updates take effect.
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(envVars)));
    const configurationHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    await this.ctx.blockConcurrencyWhile(async () => {
      if (await this.ctx.storage.get("configurationHash") !== configurationHash) {
        // stop() only sends a signal; destroy() waits for teardown before restart.
        await this.destroy();
        await this.ctx.storage.put("configurationHash", configurationHash);
      }
    });
    await this.startAndWaitForPorts({ startOptions: { envVars }, cancellationOptions: { portReadyTimeoutMS: 90000 } });
    const headers = new Headers(request.headers);
    headers.set("X-Forwarded-Proto", "https");
    const response=await this.containerFetch(new Request(request, { headers }));
    const url=new URL(request.url);
    if(response.ok && ["/api/company","/api/admin/attendance/payroll-schedule","/api/internal/payroll-summary"].includes(url.pathname)) {
      const payload=await response.clone().json().catch(()=>null);
      const company=payload?.company || (url.pathname === "/api/company" ? payload : null);
      if(company?.id && typeof company.payrollSummaryEnabled === "boolean") {
        await this.ctx.blockConcurrencyWhile(async()=>{
          const schedules=await this.ctx.storage.get("payrollSchedules") || {};
          if(company.payrollSummaryEnabled)schedules[company.id]={id:company.id,timezone:company.timezone,anchor:company.payrollCycleStartDate,days:company.payrollSummaryDays,hour:company.payrollSummaryHour,enabled:true};
          else delete schedules[company.id];
          await this.ctx.storage.put("payrollSchedules",schedules);
        });
      } else if(Array.isArray(payload?.schedules)) {
        await this.ctx.storage.put("payrollSchedules",Object.fromEntries(payload.schedules.map(schedule=>[schedule.id,schedule])));
        await this.ctx.storage.put("payrollSchedulesInitialized",true);
      }
    }
    return response;
  }
}

export default {
  async scheduled(event, env, ctx) {
    const container=getContainer(env.CLOCKFIELD,"primary");
    const schedules=await container.getPayrollSchedules();
    if(schedules) {
      const due=Object.values(schedules).some(schedule=>{
        if(!schedule.enabled || !schedule.anchor)return false;
        const parts=new Intl.DateTimeFormat("en-US",{timeZone:schedule.timezone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
        const today=["year","month","day"].map(type=>parts.find(part=>part.type===type).value).join("-");
        const hour=Number(new Intl.DateTimeFormat("en-GB",{timeZone:schedule.timezone,hour:"2-digit",hourCycle:"h23"}).format(new Date()));
        const elapsed=Math.round((Date.parse(today+"T12:00:00Z")-Date.parse(schedule.anchor+"T12:00:00Z"))/86400000);
        const daySinceClose=((elapsed%14)+14)%14+1;
        return hour>=schedule.hour && schedule.days.includes(daySinceClose);
      });
      if(!due)return;
    }
    const timestamp = String(Date.now());
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signature = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`payroll-summary:${timestamp}`))), byte => byte.toString(16).padStart(2, "0")).join("");
    ctx.waitUntil(container.fetch(new Request("https://clockfield.com/api/internal/payroll-summary", { method: "POST", headers: { "X-ClockField-Timestamp": timestamp, "X-ClockField-Signature": signature, "X-ClockField-Deployment-Revision": env.CF_VERSION_METADATA?.id || "payroll-cron-v1" } })).then(response => { if (!response.ok) throw new Error(`Payroll summary job failed (${response.status})`); }));
  },
  fetch(request, env) {
    const headers = new Headers(request.headers);
    // Resolve version metadata in the Worker and overwrite any client-provided value.
    headers.set("X-ClockField-Deployment-Revision", env.CF_VERSION_METADATA?.id || "revision-forwarding-v1");
    return getContainer(env.CLOCKFIELD, "primary").fetch(new Request(request, { headers }));
  },
};
