import { Container, getContainer } from "@cloudflare/containers";

const secretNames = ["DATABASE_URL", "SESSION_SECRET", "SUPABASE_STORAGE_KEY", "MAILGUN_API_KEY", "MAILGUN_DOMAIN", "MAIL_FROM", "OPENAI_API_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_STARTER_MONTHLY", "STRIPE_PRICE_STARTER_YEARLY", "STRIPE_PRICE_GROWTH_MONTHLY", "STRIPE_PRICE_GROWTH_YEARLY", "STRIPE_PRICE_PRO_MONTHLY", "STRIPE_PRICE_PRO_YEARLY"];

export class ClockFieldContainer extends Container {
  defaultPort = 8080;
  sleepAfter = "1h";
  enableInternet = true;

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
    return this.containerFetch(new Request(request, { headers }));
  }
}

export default {
  fetch(request, env) {
    const headers = new Headers(request.headers);
    // Resolve version metadata in the Worker and overwrite any client-provided value.
    headers.set("X-ClockField-Deployment-Revision", env.CF_VERSION_METADATA?.id || "revision-forwarding-v1");
    return getContainer(env.CLOCKFIELD, "primary").fetch(new Request(request, { headers }));
  },
};
