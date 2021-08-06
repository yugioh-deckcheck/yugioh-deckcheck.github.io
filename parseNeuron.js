(()=>{
    
const IMAGE_DB = (async () =>
{
    return (await fetch('neuron/imagedb.json')).json();
})();

let CURRENT_DATA = null;
let CURRENT_IMAGE = null;

const logger = document.getElementById('neuronparse-log');
const origCanvas = document.getElementById('neuron-canvas-original');
const genCanvas = document.getElementById('neuron-canvas-generated');
const overlayCanvas = document.getElementById('neuron-canvas-overlay');
const nextButton = document.getElementById('neuronparse-next');

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
    
    nextButton.timer = 3;
    nextButton.disabled = true;
    nextButton.disabledForTimer = true;
    if (!nextButton.disabledForCard)
        nextButton.value = 'Wait 3…';

    __tickItv = window.setInterval(() =>
    {
        genCanvas.classList.toggle('hidden');
        
        if (!nextButton.timer) return;
        if (!--nextButton.timer)
        {
            nextButton.disabledForTimer = false;
            
            nextButton.disabled = nextButton.disabledForCard;
            if (!nextButton.disabledForCard)
                nextButton.value = 'Confirm';
        }
        else if (!nextButton.disabledForCard)
            nextButton.value = ('Wait '+nextButton.timer+'…');
    }, 1000);
});

document.getElementById('neuronparse-close').addEventListener('click', () =>
{
    if (document.body.className !== 'state-neuronparse')
        return;
    
    CURRENT_DATA = null;
    if (CURRENT_IMAGE)
        CURRENT_IMAGE.close()
    CURRENT_IMAGE = null;

    DisableTicks();
    document.getElementById('pdf-input').value = '';
    document.body.className = 'state-choose';
});

const remapSingleDeck = ((cards) => cards.map(({current: {cardId}}) => cardId));
const remapCurrentData = (() =>
{
    let main = [], extra = [], side = [];
    for (const {which, cards} of CURRENT_DATA)
    {
        if (which === 'Main')
            main = remapSingleDeck(cards);
        else if (which === 'Extra')
            extra = remapSingleDeck(cards);
        else if (which === 'Side')
            side = remapSingleDeck(cards);
    }
    return {main, extra, side};
});

nextButton.addEventListener('click', async () =>
{
    if (document.body.className !== 'state-neuronparse')
        return;
    
    StartLoading();
    
    await EnsureScriptLoaded('state-decklist.js');
    
    const deckData = {
        name: 'Neuron Export',
        decks: remapCurrentData(), /* { main, extra, side } */
    };
    window.SetupDeckList('state-neuronparse', deckData);
});

const cardname = (async (cardid) =>
{
    const carddata = await GetCardData(cardid);
    const n = (carddata.cardData.en || carddata.cardData.ja).name;
    if (n.length > 25)
        return n.substr(0,25)+'…';
    else
        return n;
});

const VisualizeCurrentData = (async () =>
{
    const decks = CURRENT_DATA;
    
    Log(logger, 'Visualizing, please wait...');
    DisableTicks();
    
    genCanvas.classList.add('redrawing');
    const genCtx = genCanvas.getContext('2d');
    genCtx.fillStyle = '#555';
    genCtx.fillRect(0, 0, genCanvas.width, genCanvas.height);
    
    await Promise.all(decks.map(async ({top, which, cards}) => 
    {
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
        genCtx.fillText(which+' Deck: '+cards.length+' cards', 30, top-16, 436);
        
        await Promise.all(cards.map(async ({xLeft, yTop, current: {cardId, artId}}) =>
        {
            genCtx.drawImage(await GetArtwork(cardId, artId), xLeft, yTop, 48, 72);
        }));
    }));

    genCanvas.classList.remove('redrawing');
    Log(logger, 'Visualizing done.');
    
    EnableTicks();
});

let __selectedCard = null;
let __selectedGridOffset = 0;

let SetSelectedCard;

const RedrawSelectedGrid = (() =>
{
    const container = document.getElementById('neuronparse-edit-grid');
    while (container.lastElementChild)
        container.removeChild(container.lastElementChild);
    
    if (!__selectedCard) return;
    
    document.getElementById('neuronparse-edit-status').innerText = ((__selectedGridOffset+1)+'-'+(__selectedGridOffset+24)+' of '+__selectedCard.scores.length);
    document.getElementById('neuronparse-edit-left').disabled = !__selectedGridOffset;
    document.getElementById('neuronparse-edit-right').disabled = (__selectedGridOffset+24 >= __selectedCard.scores.length);
    
    __selectedCard.scores
      .slice(__selectedGridOffset, __selectedGridOffset+24)
      .map((data) =>
    {
        const {cardId, artId, scores} = data;
        const elm = document.createElement('div');
        elm.addEventListener('click', () => {
            if (__selectedCard.current === data)
            {
                SetSelectedCard(null)
                return;
            }
            __selectedCard.current = data;
            SetSelectedCard(null);
            VisualizeCurrentData();
        });
        
        const img = document.createElement('img');
        GetArtwork(cardId, artId).then((a) => { img.src = a.src; });
        elm.appendChild(img);
        
        const span = document.createElement('span');
        span.innerText = (scores.total.toFixed(2)+'%');
        elm.appendChild(span);
        
        container.appendChild(elm);
    });
});

document.getElementById('neuronparse-edit-left').addEventListener('click', () =>
{
    __selectedGridOffset = Math.max(0, __selectedGridOffset-24);
    RedrawSelectedGrid();
});
document.getElementById('neuronparse-edit-right').addEventListener('click', () =>
{
    __selectedGridOffset += 24;
    RedrawSelectedGrid();
});

const selCanvas = document.getElementById('neuronparse-edit-show');
SetSelectedCard = ((card) =>
{
    if (__selectedCard === card) card = null;
    const ctx = overlayCanvas.getContext('2d');
    ctx.clearRect(0, 0, 496, overlayCanvas.height);
    __selectedCard = card;
    if (!card)
    {
        nextButton.disabledForCard = false;
        nextButton.disabled = nextButton.disabledForTimer;
        if (!nextButton.disabledForTimer)
            nextButton.value = 'Confirm';
        else
            nextButton.value = ('Wait '+nextButton.timer+'…');
        document.getElementById('neuronparse-edit-box').classList.remove('content');
        return;
    }
    
    nextButton.disabled = true;
    nextButton.disabledForCard = true;
    nextButton.value = '-';
    
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, 496, overlayCanvas.height);
    
    ctx.clearRect(card.xLeft, card.yTop, 48, 72);
    
    ctx.drawImage(origCanvas, card.xLeft, card.yTop, 48, 72, card.xLeft, card.yTop, 48, 72);
    
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#33f';
    ctx.strokeRect(card.xLeft, card.yTop, 48, 72);
    
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#99f';
    ctx.strokeRect(card.xLeft-5, card.yTop-5, 58, 82);
    
    const selCtx = selCanvas.getContext('2d');
    selCtx.drawImage(origCanvas, card.xLeft, card.yTop, 48, 72, 0, 0, selCanvas.width, selCanvas.height);
    
    __selectedGridOffset = 0;
    RedrawSelectedGrid();
    document.getElementById('neuronparse-edit-box').classList.add('content');
});

origCanvas.addEventListener('click', (e) =>
{
    const rect = origCanvas.getBoundingClientRect();
    const factor = 496/(rect.width);
    const relX = (e.clientX - rect.left)*factor;
    const relY = (e.clientY - rect.top)*factor;
    
    if (!CURRENT_DATA) return;
    for (const {cards} of CURRENT_DATA)
    {
        for (const card of cards)
        {
            const dX = relX - card.xLeft;
            const dY = relY - card.yTop;
            if ((0 <= dX) && (dX <= 48) && (0 <= dY) && (dY <= 72))
            {
                SetSelectedCard(card);
                return;
            }
        }
    }
    SetSelectedCard(null);
});

document.getElementById('neuronparse-ocr').addEventListener('click', async () =>
{
    if (!CURRENT_IMAGE)
        return;
    if (document.body.className !== 'state-neuronparse')
        return;
    StartLoading();
    await EnsureScriptLoaded('parseOCR.js');
    window.SetupOCRFromImageBitmap('state-neuronparse', CURRENT_IMAGE);
});

document.getElementById('neuronparse-flip').addEventListener('click', async () =>
{
    if (!CURRENT_DATA)
        return;
    if (document.body.className !== 'state-neuronparse')
        return;
    for (let deck of CURRENT_DATA)
    {
        if (deck.which === 'Extra')
            deck.which = 'Side';
        else if (deck.which === 'Side')
            deck.which = 'Extra';
    }
    StartLoading();
    SetLoadingMessage('Redrawing...');
    await VisualizeCurrentData();
    document.body.className = 'state-neuronparse';
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
    if (CURRENT_IMAGE)
        CURRENT_IMAGE.close();
    CURRENT_IMAGE = null;

    DisableTicks();
    ClearLogs(logger);

    const image = await createImageBitmap(file).catch((e) => { console.error(e); throw 'Unsupported/unrecognized image format' });
    CURRENT_IMAGE = image;
    
    Log(logger, 'Image loaded.');
    Log(logger, 'Dims: '+image.width+'px by '+image.height+'px.');
    
    const height = Math.round(image.height*(496/image.width));
    if (image.width !== 496)
        Log(logger, 'Conv: 496px by '+height+'px.');

    origCanvas.width = 496;
    origCanvas.height = height;
    
    const origCtx = origCanvas.getContext('2d');
    origCtx.drawImage(image, 0, 0, 496, height);
    
    genCanvas.width = 496;
    genCanvas.height = height;
    genCanvas.getContext('2d').clearRect(0, 0, 496, height);
    
    overlayCanvas.width = 496;
    overlayCanvas.height = height;
    SetSelectedCard(null);
    
    try
    {
        if (headerscore(origCtx, 64) < 200)
            throw 'Header score for Main Deck header too low. Are you sure this is a Neuron export?';
        
        SetLoadingMessage('Analyzing...');
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
                    await sleep(0); // prevent browser freezes
                    
                    const scores =
                      imagedb
                        .map(([cardId,artId,thisFingerprint]) => {
                            const scores = CardFingerprint.Compare(fingerprint, thisFingerprint);
                            if (scores.total > 40)
                                return {cardId, artId, scores}
                        })
                        .filter((o)=>(o))
                        .sort((a,b) => (b.scores.total - a.scores.total));
                    
                    if (!scores.length)
                        throw ('Failed to find any artwork matches for card in deck '+decks.length+' at ('+gridX+','+gridY+')');

                    GetArtwork(scores[0].cardId, scores[0].artId); // prefetch
                    
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
            throw 'Did not find any Decks. Not sure how this happened.';
        
        if (decks.length > 3)
            throw ('Found too many Decks ('+decks.length+'), expected no more than 3.');
        
        decks[0].which = 'Main';
        if (decks.length === 3)
        {
            decks[1].which = 'Extra';
            decks[2].which = 'Side';
        }
        else if (decks.length === 2)
        {
            await window.CardIndexLoaded;
            const extraDeckCards = window.CardIndex.TypeToCards.extra;
            decks[1].which = (decks[1].cards.some(({current: {cardId}}) => !extraDeckCards.has(cardId)) ? 'Side' : 'Extra');
        }
        
        CURRENT_DATA = decks;
        
        SetLoadingMessage('Processing...');
        
        await sleep(0);
        
        await VisualizeCurrentData();
        document.body.className = 'state-neuronparse';
    } catch (e) {
        console.error(e);
        Log(logger, ' ');
        Log(logger, '='.repeat(20));
        Log(logger, 'Failed:');
        Log(logger, ''+e);
        Log(logger, '='.repeat(20));
        
        nextButton.disabled = true;
        nextButton.value = 'Failed 😔\uFE0E';
        
        document.body.className = 'state-neuronparse';
    }
};

})();
