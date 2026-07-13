import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'Deen Desk',
  webDir: 'www',
  server: {
    url: 'https://deendesk-290526.web.app',
    cleartext: true
  }
};

export default config;
