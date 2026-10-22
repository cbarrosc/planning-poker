import { APP_VERSION } from '../appInfo';

export function Copyright() {
  return (
    <small className="copyright">v{APP_VERSION}</small>
  );
}
