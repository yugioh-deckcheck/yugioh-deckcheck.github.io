(()=>{

let _loadCache = {};

window.EnsureScriptLoaded = ((url) => (_loadCache[url] || (_loadCache[url] = new Promise((resolve, reject) =>
{
    let e = document.createElement('script');
    e.src = url;
    e.addEventListener('load', resolve);
    e.addEventListener('error', reject);
    document.head.appendChild(e);
}))));

window.sleep = ((ms) => new Promise((r) => setTimeout(r, ms)));

window.Log = ((box, msg, cls) =>
{
    const ctr = document.createElement('span');
    ctr.innerText = (''+msg);
    if (cls) ctr.className = cls;
    box.insertBefore(ctr, box.firstElementChild);
});

window.ClearLogs = ((box) => { 
    while (box.lastElementChild)
        box.removeChild(box.lastElementChild);
});

window.StartLoading = (() =>
{
    window.SetLoadingMessage('Loading...');
    document.body.className = 'state-loading';
});

window.SetLoadingMessage = ((m) =>
{
    document.getElementById('loading-box').lastElementChild.innerText = m;
});

})();
