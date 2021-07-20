(()=>{
    
const IMAGE_DB = (async () =>
{
    return (await fetch('neuron/imagedb.json')).json();
})();

const logger = document.getElementById('neuronparse-log');
const origCanvas = document.getElementById('neuron-canvas-original');

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
    return (carddata.cardData.en || carddata.cardData.ja).name;
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
    ClearLogs(logger);

    const image = await createImageBitmap(file);
    
    Log(logger, 'This is a demonstration of Neuron parsing. Full functionality NYI. Be advised that the \'Continue\' button will do nothing.');
    
    Log(logger, 'Image loaded.');
    Log(logger, 'Dimensions: '+image.width+'px wide, '+image.height+'px high.');
    
    const height = Math.round(image.height*(496/image.width));
    if (image.width !== 496)
        Log(logger, 'Scaling to: 496px wide, '+height+'px high.');

    origCanvas.width = 496;
    origCanvas.height = height;
    
    const origCtx = origCanvas.getContext('2d');
    origCtx.drawImage(image, 0, 0, 496, height);
    
    document.body.className = 'state-neuronparse';
    
    if (headerscore(origCtx, 64) < 200)
    {
        Log(logger, 'Header score for Main Deck header too low. Are you sure this is a Neuron export?');
        return;
    }
    
    await EnsureScriptLoaded('neuron/cardident.js');
    
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
        for (let y=0; y<rows; ++y)
        {
            const yTop = top + 72*y;
            let xLeft = 0;
            for (let x=0; x<10; ++x, xLeft += 48)
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
                    x,
                    y,
                    current: scores[0],
                    scores
                });
            }
        }
        decks.push(cards)
        top += 72*rows; // card height
        top += 32;      // skip header
    }
    
    Log(logger, 'Found '+decks.length+' decks in image.');
    for (let i=0; i<decks.length; ++i)
    {
        Log(logger, 'Deck #'+i+' ('+decks[i].length+' card(s)):');
        for (const {x,y,current} of decks[i])
            Log(logger, '['+x+','+y+'] '+current.scores.total.toFixed(2)+'% '+(await cardname(current.cardId)));
    }
};

})();
