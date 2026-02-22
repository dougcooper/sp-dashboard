// 1. Register a button in the main app header to open your UI
// PluginAPI.registerHeaderButton({
//   label: 'Date Range Reporter',
//   icon: 'bar_chart',
//   onClick: () => {
//     // This command renders your index.html inside the main view iframe
//     PluginAPI.showIndexHtmlAsView();
//   },
// });

console.log("Date Range Reporter plugin loaded!");

// We listen to the global Redux ACTION hook.
// Whenever the user adds a task, tracks time, or changes a project, this fires.
PluginAPI.registerHook(PluginAPI.Hooks.ACTION, (action) => {
  
  // Super Productivity renders UI plugins inside sandboxed iframes.
  // We locate our specific iframe and send it a lightweight trigger to refresh its data.
  const iframes = document.querySelectorAll('iframe');
  
  iframes.forEach((iframe) => {
    if (iframe.src && iframe.src.includes('index.html')) {
      iframe.contentWindow.postMessage({ 
        type: 'SP_STATE_CHANGED' 
      }, '*');
    }
  });
});
