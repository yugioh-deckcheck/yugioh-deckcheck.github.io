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

const GetMissingArtwork = (async (cardId, knownArtworks) =>
{
    let { artworks } = await (await fetch('https://db.ygorganization.com/data/card/'+cardId)).json();
    if (knownArtworks)
        artworks = artworks.filter((artId) => !knownArtworks.has(artId));
    return Promise.all(artworks.map(async (artId) => 
    {
        return [
            cardId,
            artId,
            await createImageBitmap(await (await fetch('https://db.ygorganization.com/artwork/'+cardId+'/'+artId)).blob())
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
        
        statusElm.innerText = 'Loading existing data...';
        const existing = await (await fetch('/neuron/imagedb.json')).json();
        statusElm.innerText = 'Processing existing data...';
        await sleep(0);
        
        const cardIndex = {};
        for (const [cardId, artId, fingerprint] of existing)
        {
            const cardData = (cardIndex[cardId] || (cardIndex[cardId] = { artworks: new Set() }));
            cardData.artworks.add(artId);
        }
        
        statusElm.innerText = 'Fetching artwork count index...';
        const artIndex = Object.entries(await (await fetch ('https://db.ygorganization.com/data/idx/card/artwork_count')).json());
        statusElm.innerText = 'Processing artwork count index...';
        await sleep(0);
        
        let promises = null;
        for (const [count, cards] of artIndex)
        {
            for (const cardId of cards)
            {
                if (cardId <= 0) continue;
                const ourIdx = (cardIndex[cardId] && cardIndex[cardId].artworks);
                if (ourIdx && (ourIdx.size >= count))
                    continue;
                const p = GetMissingArtwork(cardId, ourIdx);
                if (promises)
                    promises.push(p);
                else
                {
                    try { promises = [await p]; }
                    catch (e) { statusElm.innerText = 'You are not supposed to be here...'; return; }
                }
            }
        }
        
        if (!promises)
        {
            statusElm.innerText = 'Nothing to do here.';
            return;
        }
        
        statusElm.innerText = 'Requesting missing artwork...';
        const artworks = await Promise.all(promises);
        
        const mask = await MASK;
        const nTotal = artworks.reduce((a,c) => a+c.length, 0);
        let nDone = 0;
        for (const arr of artworks)
        {
            for (const [cardId, artId, bitmap] of arr)
            {
                const fingerprint = await CardFingerprint.Fingerprint(bitmap, null, null, null, null, mask);
            
                document.getElementById('bla').getContext('2d').drawImage(bitmap, 0, 0, 200, 290);
                CardFingerprint.Visualize(document.getElementById('bla2'), fingerprint);
                
                ++nDone;
                statusElm.innerText = (nDone+'/'+nTotal+' done ('+((nDone*100/nTotal).toFixed(2))+'%)');
                existing.push([cardId, artId, fingerprint]);
                await sleep(0);
            }
        }
        statusElm.innerText = 'Done, offering download';
        
        DOWNLOAD('imagedb.json', 'data:text/plain;charset=utf-8,'+encodeURIComponent(JSON.stringify(existing)+'\n'));
    } catch (e) {
        console.error(e);
        statusElm.innerText = ('Failed: '+e);
    } finally { startButton.disabled = false; }
});
