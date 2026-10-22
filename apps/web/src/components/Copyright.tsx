declare const __APP_VERSION__: string;

export function Copyright() {
  return (
    <small className="copyright">
      © 2026 Camilo Barros - Eduardo Rojas <span aria-hidden="true">·</span> v{__APP_VERSION__}
    </small>
  );
}
