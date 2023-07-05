let DOWNLOAD = ((name, url) =>
{
    const e = document.createElement('a');
    e.href = url;
    e.download = name;
    e.click();
});

const GetMissingArtwork = (async (cardId, artworks, knownArtworks) =>
{
    if (knownArtworks)
        artworks = artworks.filter(([artId,data]) => !knownArtworks.has(+artId));
    return Promise.all(artworks.map(async ([artId,data]) => 
    {
        const url = new URL(data.bestArt, 'https://artworks.ygorganization.com/').href;
        if (!url.includes('-n.ygorg'))
            return Promise.resolve([+cardId, +artId, null]);
        return [
            +cardId,
            +artId,
            await createImageBitmap(
                await (await fetch(url, {cache: 'reload'})).blob()
            )
        ];
    }));
});

const statusElm = document.getElementById('status');
const startButton = document.getElementById('start');
startButton.addEventListener('click', async () =>
{
    startButton.disabled = true;
    try
    {
        await EnsureScriptLoaded('/neuron/cardident.js');
        await CardFingerprint.Ready();
        
        statusElm.innerText = 'Loading existing data...';
        const existingJSON = await (await fetch('/neuron/imagedb.json', {cache: 'reload'})).text();
        const existing = JSON.parse(existingJSON);
        statusElm.innerText = 'Processing existing data...';
        await sleep(0);
        
        const cardIndex = {};
        for (const [cardId, artId, fingerprint] of existing)
        {
            const cardData = (cardIndex[cardId] || (cardIndex[cardId] = { artworks: new Set() }));
            cardData.artworks.add(artId);
        }
        
        statusElm.innerText = 'Fetching artwork count index...';
        const artIndex = Object.entries((await (await fetch ('https://artworks.ygorganization.com/manifest.json')).json()).cards);
        statusElm.innerText = 'Processing artwork count index...';
        await sleep(0);
        
        let promises = [];
        for (const [cardId, artworksData] of artIndex)
        {
            if (cardId <= 0) continue;
            const artworks = Object.entries(artworksData);
            const ourIdx = (cardIndex[cardId] && cardIndex[cardId].artworks);
            if (ourIdx && (ourIdx.size >= artworks.length))
                continue;
            const p = GetMissingArtwork(cardId, artworks, ourIdx);
            promises.push(p);
        }
        
        if (!promises.length)
        {
            statusElm.innerText = 'Nothing to do here.';
            return;
        }
        
        statusElm.innerText = 'Requesting missing artwork...';
        const artworks = await Promise.all(promises);
        
        const nTotal = artworks.reduce((a,c) => a+c.length, 0);
        let nDone = 0;
        let entries = [];
        for (const arr of artworks)
        {
            for (const [cardId, artId, bitmap] of arr)
            {
                if (bitmap)
                {
                    const fingerprint = await CardFingerprint.Fingerprint(bitmap);
                
                    document.getElementById('bla').getContext('2d').drawImage(bitmap, 0, 0, 200, 290);
                    CardFingerprint.Visualize(document.getElementById('bla2'), fingerprint);
                    entries.push([cardId, artId, fingerprint]);
                }
                else
                {
                    console.warn('skipped (not neuron)', cardId, artId);
                }
                
                ++nDone;
                statusElm.innerText = (nDone+'/'+nTotal+' done ('+((nDone*100/nTotal).toFixed(2))+'%)');
                await sleep(0);
            }
        }
        
        if (!entries.length) { statusElm.innerText = 'Done, unchanged.'; return; }
            
        statusElm.innerText = 'Done, offering download...';
        
        // this adds a line break before each batch of entries, and makes the resulting diffs nicer on git
        const newJSON = JSON.stringify(entries);
        const result = 
            existingJSON.substring(0,existingJSON.length-2) /* strip the trailing ]\n */ +
            ',' + newJSON.substring(1,newJSON.length-1) /* strip the outer braces */ +
            '\n]\n';
        try { JSON.parse(result); } catch (f) { console.warn(f); console.warn(result); throw 'Resulting patchwerk JSON not actually JSON, oops?'; }
        DOWNLOAD('imagedb.json', 'data:text/plain;charset=utf-8,'+encodeURIComponent(result));
    } catch (e) {
        console.error(e);
        statusElm.innerText = ('Failed: '+e);
    } finally { startButton.disabled = false; }
});
