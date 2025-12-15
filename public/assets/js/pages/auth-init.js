(function() {
  const tabSign = document.getElementById('tab-signin');
  const tabCreate = document.getElementById('tab-create');
  const panelSign = document.getElementById('panel-signin');
  const panelCreate = document.getElementById('panel-create');
  
  if (tabSign && tabCreate && panelSign && panelCreate) {
    tabSign.addEventListener('click', () => {
      tabSign.setAttribute('aria-selected', 'true');
      tabCreate.setAttribute('aria-selected', 'false');
      panelSign.hidden = false;
      panelCreate.hidden = true;
    });
    
    tabCreate.addEventListener('click', () => {
      tabSign.setAttribute('aria-selected', 'false');
      tabCreate.setAttribute('aria-selected', 'true');
      panelSign.hidden = true;
      panelCreate.hidden = false;
    });
  }
})();
