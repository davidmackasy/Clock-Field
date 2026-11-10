export function LocationPermissionHelp() {
  return <div className="space-y-3 rounded-lg border bg-background p-3 text-sm">
    <p className="font-medium">Allow location on your phone</p>
    <p className="text-muted-foreground">ClockField needs permission from both your phone and your browser before it can check your work site.</p>
    <details open className="space-y-2">
      <summary className="cursor-pointer font-medium py-1">iPhone / Safari</summary>
      <ol className="list-decimal pl-5 space-y-2 text-muted-foreground">
        <li>Open iPhone Settings → Privacy &amp; Security → Location Services. Turn Location Services on.</li>
        <li>Select Safari Websites, allow location while using the app (or choose Ask Next Time), and turn Precise Location on. If you use another browser, check that browser’s location permission instead.</li>
        <li>Open clockfield.com in Safari. Tap the page menu beside the address, open Website Settings, and set Location to Allow or Ask. Choose Allow when prompted.</li>
      </ol>
    </details>
    <details className="space-y-2">
      <summary className="cursor-pointer font-medium py-1">Android / Chrome</summary>
      <ol className="list-decimal pl-5 space-y-2 text-muted-foreground">
        <li>Turn your phone’s Location setting on. In Settings → Apps → Chrome → Permissions → Location, allow access while using the app and enable precise location.</li>
        <li>Open clockfield.com in Chrome. Tap the site information icon beside the address → Permissions → Location, and allow access. If the option is missing, check Chrome Settings → Site settings → Location.</li>
      </ol>
    </details>
    <p className="text-muted-foreground">If you opened ClockField inside an email or messaging app, open it directly in Safari or Chrome.</p>
    <p className="font-medium">Return to ClockField and tap Try location again. You must still be within your assigned work site’s boundary.</p>
  </div>;
}
