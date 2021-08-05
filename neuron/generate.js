let DOWNLOAD = ((name, url) =>
{
    const e = document.createElement('a');
    e.href = url;
    e.download = name;
    e.click();
});

const MASK = (async () =>
{
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 290;
    const renderCtx = canvas.getContext('2d');
    
    const bmp = await createImageBitmap(await (await fetch('mask.png')).blob());
    renderCtx.drawImage(bmp, 0, 0, 200, 290);
    const mask = renderCtx.getImageData(25, 54, 150, 150);
    bmp.close();
    
    return mask;
})();

(async () => {
    const SQL = await window.initSqlJs({ locateFile: ((file) => ('https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.5.0/'+file)) });
    
    const statusElm = document.getElementById('status');
    const fileInput = document.getElementById('input');
    fileInput.addEventListener('change', async () =>
    {
        const file = fileInput.files[0];
        if (!file) return;
        
        statusElm.innerText = 'Opening DB...';
        
        const db = new SQL.Database(new Uint8Array(await file.arrayBuffer()));
        const results = db.exec('SELECT cardId, artId, artwork FROM card_artwork')[0].values;
        const nTotal = results.length;
        
        const hashes = [];
        let nDone = 0;
        const mask = await MASK;
        await EnsureScriptLoaded('/neuron/cardident.js');
        for (const [cardId, artId, artwork] of results)
        {
            const artFile = new File([artwork], (cardId+'_'+artId+'.png'), { type: 'image/png' });
            const artBitmap = await createImageBitmap(artFile);
            
            const fingerprint = await CardFingerprint.Fingerprint(artBitmap, null, null, null, null, mask);
            
            document.getElementById('bla').getContext('2d').drawImage(artBitmap, 0, 0, 200, 290);
            CardFingerprint.Visualize(document.getElementById('bla2'), fingerprint);
            
            ++nDone;
            statusElm.innerText = (nDone+'/'+nTotal+' done ('+((nDone*100/nTotal).toFixed(2))+'%)');
            hashes.push([cardId, artId, fingerprint]);
        }
        
        statusElm.innerText = 'Done, offering download';
        
        DOWNLOAD('imagedb.json', 'data:text/plain;charset=utf-8,'+encodeURIComponent(JSON.stringify(hashes)+'\n'));
    });
})();
