(()=>{
    
const __artCache = {}
const getArtwork = ((cardId,artId) => (__artCache[cardId+','+artId] || (__artCache[cardId+','+artId] = (async () =>
{
    const img = new Image();
    img.src = ('https://db.ygorganization.com/artwork/'+cardId+'/'+artId);
    await img.decode();
    return createImageBitmap(img);
})())));
    
const IMAGE_DB = (async () =>
{
    return (await fetch('neuron/imagedb.json')).json();
})();

let CURRENT_DATA = null;

const logger = document.getElementById('neuronparse-log');
const origCanvas = document.getElementById('neuron-canvas-original');
const genCanvas = document.getElementById('neuron-canvas-generated');

let __tickItv = 0;

const DisableTicks = (() =>
{
    window.clearInterval(__tickItv);
    __tickItv = 0;
    genCanvas.classList.remove('hidden');
});

const EnableTicks = (() =>
{
    if (__tickItv) return;
    __tickItv = window.setInterval(() => { genCanvas.classList.toggle('hidden'); }, 1000);
});

document.getElementById('neuronparse-close').addEventListener('click', () =>
{
    if (document.body.className !== 'state-neuronparse')
        return;
    document.getElementById('pdf-input').value = '';
    document.body.className = 'state-choose';
});

const cardname = (async (cardid) =>
{
    const carddata = await (await fetch('https://db.ygorganization.com/data/card/'+cardid)).json();
    const n = (carddata.cardData.en || carddata.cardData.ja).name;
    if (n.length > 25)
        return n.substr(0,25)+'…';
    else
        return n;
});

const VisualizeCurrentData = (async () =>
{
    const decks = CURRENT_DATA;
    
    Log(logger, 'Visualizing parse result, please wait...');
    DisableTicks();
    
    genCanvas.classList.add('redrawing');
    const genCtx = genCanvas.getContext('2d');
    genCtx.fillStyle = '#555';
    genCtx.fillRect(0, 0, genCanvas.width, genCanvas.height);
    
    await Promise.all(decks.map(async ({top, which, cards}) => 
    {
        console.log(which, top, cards);
        
        genCtx.fillStyle = '#335';
        genCtx.fillRect(0, 0, 496, 64);
        
        genCtx.fillStyle = '#fff';
        genCtx.textAlign = 'left';
        genCtx.textBaseline = 'middle';
        genCtx.font = '18px bold Monospace';
        genCtx.fillText('Neuron export parse results:', 10, 32, 476);
        
        
        genCtx.fillStyle = '#113';
        genCtx.fillRect(0, top, 496, -32);
        
        genCtx.fillStyle = '#fff';
        genCtx.textAlign = 'left';
        genCtx.textBaseline = 'middle';
        genCtx.font = '14px Monospace';
        genCtx.fillText(which+' Deck: '+cards.length+' cards', 15, top-16, 466);
        
        await Promise.all(cards.map(async ({xLeft, yTop, current: {cardId, artId}}) =>
        {
            genCtx.drawImage(await getArtwork(cardId, artId), xLeft, yTop, 48, 72);
        }));
    }));

    genCanvas.classList.remove('redrawing');
    Log(logger, 'Visualizing done.');
    
    EnableTicks();
    
    /* debug logging start */
    Log(logger, 'Found '+decks.length+' decks in image.');
    for (let i=0; i<decks.length; ++i)
    {
        Log(logger, ' ');
        Log(logger, '=== '+decks[i].which+' Deck ('+decks[i].cards.length+' card(s)):');
        for (const {gridX,gridY,current} of decks[i].cards)
            Log(logger, '['+gridX+','+gridY+'] '+current.scores.total.toFixed(2)+'% '+(await cardname(current.cardId)));
    }
    /* debug logging end */
});

const headerscore = ((ctx, firstY) =>
{
    let sum=0,n=0;
    const data = ctx.getImageData(1, firstY, 1, 32).data;
    for (let i=0; i<data.length; i+=4)
    {
        const r = data[i+0];
        const g = data[i+1];
        const b = data[i+2];
        const l = (r*.299 + g*.587 + b*.114);
        
        sum += l;
        ++n;
    }
    return (sum/n);
});

const edgescore = ((ctx, x, firstY) =>
{
    let sum=0,n=0;
    const data = ctx.getImageData(x, firstY, 1, 72).data;
    for (let i=0; i<data.length; i+=4)
    {
        const r = data[i+0];
        const g = data[i+1];
        const b = data[i+2];
        const l = (r*.299 + g*.587 + b*.114);
        
        sum += l;
        ++n;
    }
    return (sum/n);
});

window.ParseNeuronExport = async function(file)
{
    CURRENT_DATA = null;

    DisableTicks();
    ClearLogs(logger);

    const image = await createImageBitmap(file).catch(() => { throw 'Unsupported/unrecognized image format' });
    
    Log(logger, '='.repeat(20));
    Log(logger, 'This is a demonstration of Neuron parsing. Full functionality NYI. Be advised that the \'Continue\' button will do nothing.');
    Log(logger, '='.repeat(20));
    Log(logger, ' ');
    
    Log(logger, 'Image loaded.');
    Log(logger, 'Dimensions: '+image.width+'px wide, '+image.height+'px high.');
    
    const height = Math.round(image.height*(496/image.width));
    console.log(image.width, image.height, height);
    if (image.width !== 496)
        Log(logger, 'Scaling to: 496px wide, '+height+'px high.');

    origCanvas.width = 496;
    origCanvas.height = height;
    
    const origCtx = origCanvas.getContext('2d');
    origCtx.drawImage(image, 0, 0, 496, height);
    
    genCanvas.width = 496;
    genCanvas.height = height;
    genCanvas.getContext('2d').clearRect(0, 0, 496, height);
    
    document.body.className = 'state-neuronparse';
    
    if (headerscore(origCtx, 64) < 200)
    {
        Log(logger, 'Header score for Main Deck header too low. Are you sure this is a Neuron export?');
        return;
    }
    
    // ensure this actually gives us a render tick to avoid freezing
    await Promise.all([EnsureScriptLoaded('neuron/cardident.js'), sleep(0)]);
    
    let top = 64+32;
    let decks = [];
    const imagedb = (await IMAGE_DB);
    while (top+72 < height)
    {
        let rows = 1;
        for (;;++rows)
        {
            if (height < top+72*rows+32)
            { // last deck
                rows = Math.floor((height-top)/72);
                break;
            }
            if (headerscore(origCtx, top+72*rows) >= 200)
                break;
        }
        
        let cards = [];
        for (let gridY=0; gridY<rows; ++gridY)
        {
            const yTop = top + 72*gridY;
            let xLeft = 0;
            for (let gridX=0; gridX<10; ++gridX, xLeft += 48)
            {
                const margin1score = edgescore(origCtx, xLeft+1, yTop);
                const margin2score = edgescore(origCtx, xLeft+2, yTop);
                const margin3score = edgescore(origCtx, xLeft+3, yTop);
                if (margin1score > 45) xLeft += 1;
                else if (margin2score > 45) xLeft += 2;
                else if (margin3score > 45) xLeft += 3;
                else break;
                
                const fingerprint = await CardFingerprint.Fingerprint(origCanvas, xLeft, yTop, 48, 72);
                const scores =
                  imagedb
                    .map(([cardId,artId,thisFingerprint]) => ({cardId, artId, scores: CardFingerprint.Compare(fingerprint, thisFingerprint)}))
                    .sort((a,b) => (b.scores.total - a.scores.total));

                cards.push({
                    gridX,
                    gridY,
                    xLeft,
                    yTop,
                    current: scores[0],
                    scores
                });
            }
        }
        decks.push({top, cards})
        top += 72*rows; // card height
        top += 32;      // skip header
    }
    
    if (!decks.length)
    {
        Log(logger, 'Failed to find any decks. Not sure what happened.');
        return;
    }
    
    if (decks.length > 3)
    {
        Log(logger, 'Found too many Decks ('+decks.length+'), expected no more than 3.');
        return;
    }
    
    decks[0].which = 'Main';
    if (decks.length === 3)
    {
        decks[1].which = 'Extra';
        decks[2].which = 'Side';
    }
    else // @todo
        decks[1].which = 'Side';
    
    CURRENT_DATA = decks;
    
    await VisualizeCurrentData();
};

})();
