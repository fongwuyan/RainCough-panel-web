#!/bin/bash
cd ~/raincough-dev
node -e "
global.window = global;
import('file:///home/f/raincough-dev/plugins/webspy/assets/plugin.js').then(() => {
  console.log('window is global:', global.window === global);
  console.log('registered keys:', Object.keys(global.window).filter(k => k.startsWith('__rcPlugin_')));
  console.log('typeof reg:', typeof global.window.__rcPlugin_webspy);
}).catch(e => console.log('LOAD FAIL', e.message));
"