import { notFound } from "next/navigation";
import { NativeFileInputDiagnostic } from "@/app/dev/photo-intake/NativeFileInputDiagnostic";
import { HydrationProbe } from "@/app/dev/photo-intake/HydrationProbe";
import { DecoderDiagnostic } from "@/app/dev/photo-intake/DecoderDiagnostic";

export default function PhotoIntakeDiagnosticsPage() {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_DIAGNOSTICS !== "1") notFound();
  return (
    <main className="container">
      <script
        dangerouslySetInnerHTML={{ __html: `
          window.__diellartClientErrors = [];
          (function () {
            function record(value) {
              window.__diellartClientErrors.push(String(value));
              window.dispatchEvent(new Event('diellart-client-error'));
            }
            window.addEventListener('error', function (event) {
              record('window.error: ' + (event.error && event.error.name ? event.error.name + ': ' : '') + event.message + ' @ ' + (event.filename || '(unknown)') + ':' + (event.lineno || 0) + ':' + (event.colno || 0));
            });
            window.addEventListener('unhandledrejection', function (event) {
              var reason = event.reason;
              record('unhandledrejection: ' + (reason && reason.name ? reason.name + ': ' : '') + (reason && reason.message ? reason.message : String(reason)));
            });
            window.addEventListener('error', function (event) {
              var target = event.target;
              if (target && target !== window && (target.src || target.href)) {
                record('resource.error: ' + (target.src || target.href));
              }
            }, true);
          })();
        ` }}
      />
      <noscript>JavaScript is disabled or failed to load.</noscript>
      <p className="text-eyebrow">Development diagnostics</p>
      <h1 className="text-section-heading">Photo intake stages</h1>
      <p className="text-body">
        Upload diagnostics are reported in the browser console under
        <code> [mobile-image-decode]</code>, <code>[artwork-orchestration]</code>,
        <code> [artwork-crop]</code>, and <code>[artwork-preparation]</code>.
        Each report identifies the original, normalised working copy,
        classification and confidence, crop, prepared candidate, validation
        result, selected artwork, and renderer handoff. This route is excluded
        from production and public navigation.
      </p>
      <HydrationProbe />
      <NativeFileInputDiagnostic />
      <DecoderDiagnostic />
    </main>
  );
}
