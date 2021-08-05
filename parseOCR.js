(()=>{

let PDFJS = null;
const __pdfJsLoaded = (async () =>
{
    await EnsureScriptLoaded('include/pdfjs/pdf.js');
    PDFJS = window.pdfjsLib;
    PDFJS.GlobalWorkerOptions.workerSrc = 'include/pdfjs/pdf.worker.js';
})();

let OCR = null;
const __ocrLoaded = (async () =>
{
    console.log('OCR starting up...');
    await EnsureScriptLoaded('include/tesseract/tesseract.min.js');
    const scheduler = window.Tesseract.createScheduler();
    await Promise.all(new Array(4).fill().map(async () =>
    {
        const worker = window.Tesseract.createWorker({
            workerPath: 'include/tesseract/worker.min.js',
            langPath: 'include/tesseract/data',
            corePath: 'include/tesseract/tesseract-core.wasm.js',
        });
        await worker.load();
        await worker.loadLanguage('eng+deu+fra+ita+por+spa');
        await worker.initialize('eng+deu+fra+ita+por+spa');
        scheduler.addWorker(worker);
    }));
    console.log('OCR ready!');
    OCR = ((data, props) => scheduler.addJob('recognize', data, props));
})();

const logger = document.getElementById('ocr-log');
const origCanvas = document.getElementById('ocr-canvas-original');
const genCanvas = document.getElementById('ocr-canvas-generated');
const overlayCanvas = document.getElementById('ocr-canvas-overlay');

let SetCanvasDimensions = ((w,h) =>
{
    origCanvas.width = w;
    origCanvas.height = h;
    genCanvas.width = w;
    genCanvas.height = h;
    overlayCanvas.width = w;
    overlayCanvas.height = h;
});

const backButton = document.getElementById('ocr-back');
const nextButton = document.getElementById('ocr-next');

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
    if (!(nextButton.disabledForCard || nextButton.disabledForIncomplete))
        nextButton.value = 'Wait 3…';

    __tickItv = window.setInterval(() =>
    {
        genCanvas.classList.toggle('hidden');
        
        if (!nextButton.timer) return;
        if (!--nextButton.timer)
        {
            nextButton.disabledForTimer = false;
            
            nextButton.disabled = (nextButton.disabledForCard || nextButton.disabledForIncomplete);
            if (!nextButton.disabled)
                nextButton.value = 'Confirm';
        }
        else if (!(nextButton.disabledForCard || nextButton.disabledForIncomplete))
            nextButton.value = ('Wait '+nextButton.timer+'…');
    }, 1000);
});

let SELECTED_CARD = null;
let SELECTED_CARD_STRONG = false;
let CURRENT_PARSE_DATA = null;

let _resolvedNotifyTimeout = 0;
const UpdateIsAllResolved = (() =>
{
    _resolvedNotifyTimeout = 0;
    if (!CURRENT_PARSE_DATA.some((block) => block.cards.some((card) => !card.resolvedTo)))
    {
        nextButton.disabledForIncomplete = false;
        nextButton.disabled = nextButton.disabledForTimer || nextButton.disabledForCard;
        if (nextButton.disabledForCard)
            nextButton.value = '-';
        else if (!nextButton.disabledForTimer)
            nextButton.value = 'Confirm';
        else
            nextButton.value = ('Wait '+nextButton.timer+'…');
    }
    else
    {
        nextButton.disabled = true;
        nextButton.disabledForIncomplete = true;
        nextButton.value = '-';
    }
});

const CardJustResolvedNotify = (() =>
{
    if (_resolvedNotifyTimeout)
        return;
    _resolvedNotifyTimeout = window.setTimeout(UpdateIsAllResolved, 100);
});

let SetCardResolved = null;

const AddSelectedCardSearchResult = ((pos, locale, id, vagueName) =>
{
    const card = SELECTED_CARD;
    const container = document.getElementById('ocr-edit-results');
    
    const button = document.createElement('div');
    button.className = 'ocr-search-result';
    button.addEventListener('click', () => { SetCardResolved(card, { locale, cardId: id }, vagueName); });
    
    const flag = document.createElement('img');
    flag.className = 'ocr-search-result-flag';
    flag.src = ('img/locale_'+locale+'.png');
    button.appendChild(flag);
    
    const label = document.createElement('span');
    label.className = 'ocr-search-result-name vague';
    label.innerText = vagueName;
    button.appendChild(label);
    
    window.GetCardData(id).then(({cardData}) =>
    {
        label.innerText = cardData[locale].name;
        label.classList.remove('vague');
    });
    
    if (isNaN(pos) || (container.children.length <= pos))
        container.appendChild(button);
    else
        container.insertBefore(button, container.children[pos]);
});

const selCanvas = document.getElementById('ocr-edit-show');
const SetSelectedCard = ((card, strong) =>
{
    SELECTED_CARD_STRONG = strong;
    if (card === SELECTED_CARD) return;
    
    const ctx = overlayCanvas.getContext('2d');
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    SELECTED_CARD = card;
    if (!card)
    {
        nextButton.disabledForCard = false;
        nextButton.disabled = (nextButton.disabledForTimer || nextButton.disabledForIncomplete);
        if (nextButton.disabledForIncomplete)
            nextButton.value = '-';
        else if (nextButton.disabledForTimer)
            nextButton.value = ('Wait '+nextButton.timer+'…');
        else
            nextButton.value = 'Confirm';
        document.getElementById('ocr-edit-box').classList.remove('content');
        return;
    }
    
    nextButton.disabled = true;
    nextButton.disabledForCard = true;
    nextButton.value = '-';
    
    ctx.fillStyle = 'rgba(127,127,127,.7)';
    ctx.fillRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    
    const left = Math.min(card.countRect.left, card.nameRect.left);
    const top = Math.min(card.countRect.top, card.nameRect.top);
    const width = Math.max(card.countRect.left + card.countRect.width, card.nameRect.left + card.nameRect.width) - left;
    const height = Math.max(card.countRect.top + card.countRect.height, card.nameRect.top + card.nameRect.height) - top;
    
    ctx.clearRect(left, top, width, height);
    
    ctx.lineWidth = 45;
    ctx.strokeStyle = '#f33';
    ctx.strokeRect(left-25, top-25, width+50, height+50);
    
    ctx.lineWidth = 45;
    ctx.strokeStyle = '#f99';
    ctx.strokeRect(left-70, top-70, width+140, height+140);
    
    selCanvas.width = width;
    selCanvas.height = height;
    const selCtx = selCanvas.getContext('2d');
    selCtx.drawImage(origCanvas, left, top, width, height, 0, 0, width, height);
    
    document.getElementById('ocr-edit-count').value = card.count;
    document.getElementById('ocr-edit-search').value = card.name;
    
    if (card.searchProgress)
    {
        document.getElementById('ocr-edit-results-box').classList.add('loading');
        document.getElementById('ocr-edit-results-progress').innerText = card.searchProgress;
    }
    else
        document.getElementById('ocr-edit-results-box').classList.remove('loading');
    
    if (card.searchResults)
    {
        const resultsContainer = document.getElementById('ocr-edit-results');
        while (resultsContainer.lastElementChild)
            resultsContainer.removeChild(resultsContainer.lastElementChild);
        for (const [idxLocale, idxId, idxName] of card.searchResults)
            AddSelectedCardSearchResult(null, idxLocale, idxId, idxName);
    }
    else
        DoCardSearch(card, true);
    
    document.getElementById('ocr-edit-box').classList.add('content');
});

SetCardResolved = ((card, data, weakName) =>
{
    const isRedraw = (card.resolvedTo === data);
    card.resolvedTo = data;
    CardJustResolvedNotify();
    
    const left = Math.min(card.countRect.left, card.nameRect.left);
    const top = Math.min(card.countRect.top, card.nameRect.top);
    const width = Math.max(card.countRect.left + card.countRect.width, card.nameRect.left + card.nameRect.width) - left;
    const height = Math.max(card.countRect.top + card.countRect.height, card.nameRect.top + card.nameRect.height) - top;
    
    const drawCtx = genCanvas.getContext('2d');
    if (!data.cardId)
    {
        drawCtx.fillStyle = '#ddf';
        drawCtx.fillRect(left, top, width, height);
        return;
    }
    
    drawCtx.fillStyle = '#fff';
    drawCtx.fillRect(left, top, width, height);
    
    drawCtx.font = (height*.8)+'px Helvetica, sans-serif';
    drawCtx.textBaseline = 'middle';
    drawCtx.textAlign = 'left';
    drawCtx.fillStyle = '#555';
    drawCtx.fillText(card.count+'x '+weakName, left + width*.02, top + height*.5, width*.96);
    
    window.GetCardData(data.cardId).then(({cardData}) =>
    {
        if (card.resolvedTo !== data)
            return;
        const realCardName = cardData[data.locale].name;
        drawCtx.fillStyle = '#fff';
        drawCtx.fillRect(left, top, width, height);
        
        drawCtx.font = (height*.8)+'px Helvetica, sans-serif';
        drawCtx.textBaseline = 'middle';
        drawCtx.textAlign = 'left';
        drawCtx.fillStyle = '#000';
        drawCtx.fillText(card.count+'x '+realCardName, left + width*.02, top + height*.5, width*.96);
    });
    
    if (!isRedraw && (card === SELECTED_CARD))
    {
        if (!SELECTED_CARD_STRONG)
        {
            for (const block of CURRENT_PARSE_DATA)
            {
                const card = block.cards.find((c) => !c.resolvedTo);
                if (card)
                {
                    SetSelectedCard(card);
                    return;
                }
            }
        }
        SetSelectedCard(null);
    }
});

origCanvas.addEventListener('click', (e) =>
{
    const rect = origCanvas.getBoundingClientRect();
    const factor = origCanvas.width/(rect.width);
    const relX = (e.clientX - rect.left)*factor;
    const relY = (e.clientY - rect.top)*factor;
    
    if (!CURRENT_PARSE_DATA) return;
    for (const {cards} of CURRENT_PARSE_DATA)
    {
        for (const card of cards)
        {
            const left = Math.min(card.countRect.left, card.nameRect.left);
            const top = Math.min(card.countRect.top, card.nameRect.top);
            const width = Math.max(card.countRect.left + card.countRect.width, card.nameRect.left + card.nameRect.width) - left;
            const height = Math.max(card.countRect.top + card.countRect.height, card.nameRect.top + card.nameRect.height) - top;
            
            const dX = relX - left;
            const dY = relY - top;
            if ((0 <= dX) && (dX <= width) && (0 <= dY) && (dY <= height))
            {
                if (card === SELECTED_CARD)
                    SetSelectedCard(null);
                else
                    SetSelectedCard(card, true);
                return;
            }
        }
    }
    SetSelectedCard(null);
});

let DoCardSearch = (async (card, full) =>
{
    
    const drawCtx = genCanvas.getContext('2d');
    
    if (!card.count && !card.name)
    {
        SetCardResolved(card, { locale: null, cardId: null });
        return;
    }

    const cardName = card.name;
    const searchName = window.NormalizeNameLax(cardName);
    const searchResults = [];
    card.searchResults = searchResults;
    
    if (SELECTED_CARD === card)
    {
        const resultsContainer = document.getElementById('ocr-edit-results');
        while (resultsContainer.lastElementChild)
            resultsContainer.removeChild(resultsContainer.lastElementChild);
    }
    /* everything above this comment should be in the initial run, before the first await! */
    
    const idxs = await Promise.all(card.indexes.map((k) => window.CardIndexLoaded.then(() => window.CardIndex.TypeToCards[k])));
    if (card.searchResults !== searchResults)
        return;
    
    const perfectMatch = window.CardIndex.StrictNameToCard[window.NormalizeNameStrict(cardName)];
    if (perfectMatch && idxs.some((idx) => idx.has(perfectMatch[1])))
    {
        const [ locale, cardId ] = perfectMatch;
        if (!card.resolvedTo)
            SetCardResolved(card, { locale, cardId }, cardName);

        if (!full)
        {
            card.searchResults = null;
            return;
        }
    }
    
    const left = Math.min(card.countRect.left, card.nameRect.left);
    const top = Math.min(card.countRect.top, card.nameRect.top);
    const width = Math.max(card.countRect.left + card.countRect.width, card.nameRect.left + card.nameRect.width) - left;
    const height = Math.max(card.countRect.top + card.countRect.height, card.nameRect.top + card.nameRect.height) - top;

    if (!card.resolvedTo)
    {
        if (!SELECTED_CARD)
            SetSelectedCard(card);

        drawCtx.fillStyle = '#fbb';
        drawCtx.fillRect(left, top, width, height);
        
        drawCtx.font = 'bold '+(height*.8)+'px Monospace';
        drawCtx.textBaseline = 'middle';
        drawCtx.textAlign = 'center';
        drawCtx.fillStyle = '#555';
        drawCtx.fillText('Searching... (0%)', left + width*.5, top + height*.5, width*.96);
    }
    
    if (SELECTED_CARD === card)
    {
        document.getElementById('ocr-edit-results-box').classList.add('loading');
        document.getElementById('ocr-edit-results-progress').innerText = '0';
    }
    
    card.searchProgress = 0;
    
    let nResults0 = 0, nResults1 = 0, nResults2 = 0;
    const searchNames = window.CardIndex.CardToNamesLax;
    
    const resolvedToId = (card.resolvedTo && card.resolvedTo.cardId);
    if (resolvedToId)
    {
        ++nResults0;
        const vagueName = searchNames[resolvedToId][0][1];
        searchResults.push([card.resolvedTo.locale, resolvedToId, searchNames[resolvedToId][0][1], 0])
        AddSelectedCardSearchResult(0, card.resolvedTo.locale, resolvedToId, vagueName);
    }
    
    const nIdxs = idxs.length;
    for (let iIdxs=0; iIdxs<nIdxs; ++iIdxs)
    {
        const idx = idxs[iIdxs];
        const nIdx = idx.size;
        let iIdx = -1;
        for (const idxId of idx)
        {
            ++iIdx;
            if (!(iIdx % 200))
            {
                const progress = (((iIdxs/nIdxs)+(iIdx/nIdx/nIdxs))*100).toFixed(1);
                
                if (!card.resolvedTo)
                {
                    drawCtx.fillStyle = '#fbb';
                    drawCtx.fillRect(left, top, width, height);
                    
                    drawCtx.font = 'bold '+(height*.8)+'px Monospace';
                    drawCtx.textBaseline = 'middle';
                    drawCtx.textAlign = 'center';
                    drawCtx.fillStyle = '#555';
                    drawCtx.fillText('Searching... ('+progress+'%)', left + width*.5, top + height*.5, width*.96);
                }
                
                if (SELECTED_CARD === card)
                    document.getElementById('ocr-edit-results-progress').innerText = progress;
                
                card.searchProgress = progress;
                
                await sleep(0);
                if (card.searchResults !== searchResults)
                    return;
            }
            
            if (idxId === resolvedToId)
                continue;
            
            for (const [idxLocale, idxName] of (searchNames[idxId] || []))
            {
                const score = window.SearchDistanceScore(searchName, idxName, 4);
                if (score >= 4) continue;

                let i;
                switch (Math.floor(score))
                {
                    case 0:
                        i = nResults0;
                        ++nResults0;
                        break;
                    case 1: /* the score for substrings is in [1,2) */
                        const n = nResults0 + nResults1;
                        for (i = nResults0; i < n; ++i)
                            if (score < searchResults[i][3])
                                break;
                        ++nResults1;
                        break;
                    case 2:
                        i = nResults0 + nResults1 + nResults2;
                        ++nResults2;
                        break;
                    case 3:
                        i = searchResults.length;
                        break;
                }
                
                searchResults.splice(i, 0, [idxLocale, idxId, idxName, score]);
                if (SELECTED_CARD === card)
                    AddSelectedCardSearchResult(i, idxLocale, idxId, idxName);

                break;
            }
        }
    }
    
    card.searchProgress = null;
    if (SELECTED_CARD === card)
        document.getElementById('ocr-edit-results-box').classList.remove('loading');
    
    if (!card.resolvedTo)
    {
        drawCtx.fillStyle = '#fbb';
        drawCtx.fillRect(left, top, width, height);
        
        drawCtx.font = 'bold '+(height*.8)+'px Monospace';
        drawCtx.textBaseline = 'middle';
        drawCtx.textAlign = 'center';
        drawCtx.fillStyle = '#555';
        drawCtx.fillText('Waiting for input...', left + width*.5, top + height*.5, width*.96);
    }
});

document.getElementById('ocr-edit-count').addEventListener('change', function()
{
    if (!SELECTED_CARD)
        return;
    const count = parseInt(this.value);
    this.blur();
    if (isNaN(count))
    {
        this.value = SELECTED_CARD.count;
        return;
    }
    if (count === SELECTED_CARD.count)
        return;
    
    SELECTED_CARD.count = count;
    if (SELECTED_CARD.resolvedTo)
        SetCardResolved(SELECTED_CARD, SELECTED_CARD.resolvedTo, '<#'+SELECTED_CARD.resolvedTo.cardId+'>');
});

document.getElementById('ocr-edit-search').addEventListener('change', function()
{
    if (!SELECTED_CARD)
        return;
    const text = this.value;
    this.blur();
    if (SELECTED_CARD.name === text)
        return;
    SELECTED_CARD.name = text;
    DoCardSearch(SELECTED_CARD, true);
});

backButton.addEventListener('click', () =>
{
    if (document.body.className !== 'state-ocr')
        return;

    DisableTicks();
    const backTo = backButton.backToState;
    if (backTo === 'state-choose')
        document.getElementById('pdf-input').value = '';
    document.body.className = backTo;
});

nextButton.addEventListener('click', async () =>
{
    if (document.body.className !== 'state-ocr')
        return;
    
    StartLoading();
    
    await EnsureScriptLoaded('state-decklist.js');
    
    const deckData = {
        name: 'OCR parse result',
        decks: {
            main: [],
            extra: [],
            side: [],
        }
    }
    
    for (const [which, blockIds] of [['main',[0,1,2]],['extra',[4]],['side',[3]]])
    {
        for (const blockId of blockIds)
        {
            for (const card of CURRENT_PARSE_DATA[blockId].cards)
            {
                if (!card.resolvedTo)
                {
                    Log(logger, 'Failed to confirm. Unresolved card in block '+blockId+'?');
                    return;
                }
                for (let i=0; i<card.count; ++i)
                    deckData.decks[which].push(card.resolvedTo.cardId);
            }
        }
    }
    window.SetupDeckList('state-ocr', deckData);
});


const lumavg = (({width, data}, left, top, w, h) => {
    let sum = 0, n = 0;
    for (let y = top, maxY = top+h; y < maxY; ++y) for (let x = left, maxX = left+w; x < maxX; ++x)
    {
        const i = 4*(y*width + x);
        const l = (data[i+0]*.299 + data[i+1]*.587 + data[i+2]*.114);
        sum += l;
        ++n;
    }
    return (sum / n);
});

const whiteblock = (({width, data}, left, top, w, h) => {
    let max = 0, cur = 0;
    for (let y = top, maxY = top+h; y < maxY; ++y) for (let x = left, maxX = left+w; x < maxX; ++x)
    {
        const i = 4*(y*width + x);
        const l = (data[i+0]*.299 + data[i+1]*.587 + data[i+2]*.114);
        if (l > 252) /* "white" */
            ++cur;
        else
            cur = 0;
        if (max < cur)
            max = cur;
    }
    return max;
});

const iswhite = ((d,x,y,w,h) => (lumavg(d,x,y,w,h) > 252));

let rectCountComplete = 0, rectCountTotal = 0;
const GetTextFromRect = (async (imageData, {left, top, width, height}) =>
{
    ++rectCountTotal;
    await sleep(Math.random()*500); /* freeze preventor #1 */
    
    /* 2px margins to cut off half-black edge pixels that confuse OCR */
    left += 2;
    top += 2;
    width -= 4;
    height -= 4;
    
    const pixelData = imageData.data;
    const totalWidth = imageData.width;
    for (let y = top, maxY = top+height; y < maxY; ++y) for (let x = left, maxX = left+width; x < maxX; ++x)
    {
        const i = 4*(x + y*totalWidth);
        const l = (pixelData[i+0]*.299 + pixelData[i+1]*.587 + pixelData[i+2]*.114);
        if (l < 15) /* deep black */
        {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(origCanvas, left, top, width, height, 0, 0, canvas.width, canvas.height);
            
            const result = await OCR(canvas);
            
            ++rectCountComplete;
            SetLoadingMessage('OCR processing...\n'+(rectCountComplete*100/rectCountTotal).toFixed(0)+'% complete');
            
            return result.data.text;
        }
    }
    
    // no black pixels found, this is an empty cell, we don't need to bother OCR
    --rectCountTotal;
    
    await sleep(Math.random()*500); /* freeze preventor #2 */
    return '';
});

const DoParseBlock = (async ({data, countLeft, countWidth, nameLeft, nameWidth, headerHLine, totalHLine, hlines}) =>
{
    const lastHLine = hlines[hlines.length-1];
    
    const headerLeft = countLeft;
    const headerWidth = (nameLeft+nameWidth)-headerLeft;
    const headerTop = headerHLine.top+headerHLine.height;
    const headerHeight = hlines[0].top-headerTop;
    const headerRect = { left: headerLeft, width: headerWidth, top: headerTop, height: headerHeight };
    const headerPromise = GetTextFromRect(data, headerRect);
    
    const totalTop = lastHLine.top + lastHLine.height;
    const totalHeight = totalHLine.top - totalTop;
    
    const totalCountRect = { left: countLeft, width: countWidth, top: totalTop, height: totalHeight };
    const totalCountPromise = GetTextFromRect(data, totalCountRect);
    
    const totalLabelRect = { left: nameLeft+5, width: nameWidth-5, top: totalTop, height: totalHeight };
    const totalTextPromise = GetTextFromRect(data, totalLabelRect);
    
    const cardsData = await Promise.all(new Array(hlines.length-1).fill().map(async (_,i) =>
    {
        const topLine = hlines[i+0];
        const top = topLine.top + topLine.height;
        const bottomLine = hlines[i+1];
        const height = bottomLine.top - top;
        
        const countRect = { left: countLeft, width: countWidth, top, height };
        const countTextPromise = GetTextFromRect(data, countRect);
        
        const nameRect = { left: nameLeft,  width: nameWidth,  top, height };
        const nameTextPromise = GetTextFromRect(data, nameRect);
        
        const count = (parseInt(await countTextPromise) || 0);
        const name = (await nameTextPromise).trim();
        
        return {
            count,
            name,
            
            countRect,
            nameRect,
        };
    }));
    
    return {
        header: (await headerPromise).trim(),
        headerRect,
        
        totalCount: parseInt(await totalCountPromise),
        totalLabel: (await totalTextPromise).trim(),
        totalCountRect,
        totalLabelRect,
        
        cards: cardsData,
    };
})

let SetupOCRFromCanvasData = (async () =>
{
    let origCtx = origCanvas.getContext('2d');
    const {width, height} = origCanvas;
    
    Log(logger, ' ');
    Log(logger, 'Inspecting canvas...');
    Log(logger, 'Dims: '+width+'px by '+height+'px');
    
    SetLoadingMessage('Tracing image structure...\nGetting image data...');
    await sleep(0);
    origCtx.fillRect(0,0,0,0); /* firefox bug workaround */
    const fullImageData = origCtx.getImageData(0, 0, width, height);
    origCtx = null;
    
    SetLoadingMessage('Tracing image structure...\nFinding margins...');
    await sleep(0);
    
    Log(logger, ' ');
    Log(logger, 'Finding margins...');
    
    let leftMargin = 0;
    while ((leftMargin < width) && iswhite(fullImageData, leftMargin, 0, 1, height))
        ++leftMargin;
    
    let rightMargin = width-1;
    while ((rightMargin > leftMargin) && iswhite(fullImageData, rightMargin, 0, 1, height))
        --rightMargin;
    
    let topMargin = 0;
    while ((topMargin < height) && iswhite(fullImageData, 0, topMargin, width, 1))
        ++topMargin;
    
    let bottomMargin = height-1;
    while ((bottomMargin > topMargin) && iswhite(fullImageData, 0, bottomMargin, width, 1))
        --bottomMargin;
    
    ++rightMargin;
    ++bottomMargin;
    const marginWidth = rightMargin-leftMargin;
    const marginHeight = bottomMargin-topMargin;
    
    Log(logger, 'Left margin: '+leftMargin+'px');
    Log(logger, 'Top margin:  '+topMargin+'px');
    Log(logger, 'Content: '+marginWidth+'px by '+marginHeight+'px');
    
    SetLoadingMessage('Tracing image structure...\nFinding horizontal lines...');
    await sleep(0);
    
    Log(logger, ' ');
    Log(logger, 'Finding horiz lines...');
    
    // find top horizontal lines (span entire width)
    let hlinesTop = [];
    let currentHLine = null;
    for (let y = topMargin; y < bottomMargin; ++y)
    {
        const lum = lumavg(fullImageData, leftMargin, y, marginWidth, 1);
        const white = whiteblock(fullImageData, leftMargin, y, marginWidth, 1);
        if ((lum < 10) && (white < 5))
        {
            if (currentHLine)
                ++currentHLine.height;
            else
                hlinesTop.push((currentHLine = {top: y, height: 1}));
        }
        else
            currentHLine = null;
    }
    
    Log(logger, 'Found '+hlinesTop.length+' full hlines');
    
    const topHLine1 = hlinesTop.shift();
    const bottomHLine1 = hlinesTop.pop();
    
    // assert hline pattern - top and bottom line are bolded, rest is regular height
    if (topHLine1.height < 17)
        throw ('First hline found at y='+topHLine1.top+' not expected height, expected >=17, got '+topHLine1.height);
    if (bottomHLine1.height < 17)
        throw ('Last hline found at y='+bottomHLine1.top+' not expected height, expected >=17, got '+bottomHLine1.height);
    for (const {top,height} of hlinesTop)
        if (height > 14)
            throw ('Middle hline found at y='+top+' not expected height, expected <= 14, got '+height);
    
    SetLoadingMessage('Tracing image structure...\nFinding vertical lines...');
    await sleep(0);
    
    // find vertical lines
    let vlines = [];
    let currentVLine = null;
    const vlineStart = (hlinesTop[0].top + hlinesTop[0].height);
    const vlineHeight = (hlinesTop[hlinesTop.length-1].top - vlineStart);
    for (let x = leftMargin; x < rightMargin; ++x)
    {
        const lum = lumavg(fullImageData, x, vlineStart, 1, vlineHeight);
        const white = whiteblock(fullImageData, x, vlineStart, 1, vlineHeight);
        if ((lum < 10) && (white < 5))
        {
            if (currentVLine)
                ++currentVLine.width;
            else
                vlines.push((currentVLine = {left: x, width: 1}));
        }
        else
            currentVLine = null;
    }
    
    Log(logger, 'Found '+vlines.length+' verti lines');
    
    // assert vline pattern - there should be seven in total: bold, narrow, bold, narrow, bold, narrow, bold
    if (vlines.length !== 7)
        throw ('Unexpected number of vlines; expected 7, got '+vlines.length);
    for (let i=0; i<7; i+=2)
        if (vlines[i].width < 17)
            throw ('Odd vline at i='+i+' is too narrow, expected width >= 17, got '+vlines[i].width+' instead');
    for (let i=1; i<7; i+=2)
        if (vlines[i].width > 14)
            throw ('Even vline at i='+i+' is too wide, expected width <= 14, got '+vlines[i].width+' instead');
    
    SetLoadingMessage('Tracing image structure...\nFinding more horizontal lines...');
    await sleep(0);
    
    // using the vline pattern (first five vlines are identical), find the bottom roster hlines
    let hlinesBottom = [];
    let currentHLine2 = null;
    const hline2Start = vlines[0].left;
    const hline2Width = vlines[4].left + vlines[4].width - hline2Start;
    for (let y = bottomHLine1.top + bottomHLine1.height; y < bottomMargin; ++y)
    {
        const lum = lumavg(fullImageData, hline2Start, y, hline2Width, 1);
        const white = whiteblock(fullImageData, hline2Start, y, hline2Width, 1);
        if ((lum < 10) && (white < 5))
        {
            if (currentHLine2)
                ++currentHLine2.height;
            else
                hlinesBottom.push((currentHLine2 = {top: y, height: 1}));
        }
        else
            currentHLine2 = null;
    }
    
    Log(logger, 'Found '+hlinesBottom.length+' bottom hlines');

    const topHLine2 = hlinesBottom.shift();
    const bottomHLine2 = hlinesBottom.pop();
    
    // assert hline pattern - top is bolded (as it should be), but for some reason the bottom isn't along the entire line (gg konami)
    if (topHLine2.height < 17)
        throw ('First hline found at y='+topHLine2.top+' not expected height, expected >=17, got '+topHLine2.height);
    if ((bottomHLine2.height < 17) && (bottomHLine2.height > 14))
        throw ('Last hline found at y='+bottomHLine2.top+' not expected height, expected >=17 or <=14, got '+bottomHLine2.height);
    for (const {top,height} of hlinesBottom)
        if (height > 14)
            throw ('Middle hline found at y='+top+' not expected height, expected <= 14, got '+height);
    
    SetLoadingMessage('Image structure OK.\nWaiting for OCR startup...');
    await __ocrLoaded;
    
    SetLoadingMessage('Image structure OK.\nSetting up OCR...');
    await sleep(0);
    
    rectCountComplete = 0;
    rectCountTotal = 0;
    let blockPromises = [null, null, null, null, null];
    for (const vlineStart of [0,2,4])
    {
        const countLeft  = (vlines[vlineStart+0].left + vlines[vlineStart+0].width);
        const countWidth = (vlines[vlineStart+1].left - countLeft);
        const nameLeft   = (vlines[vlineStart+1].left + vlines[vlineStart+1].width);
        const nameWidth  = (vlines[vlineStart+2].left - nameLeft);
        
        blockPromises[vlineStart/2] = DoParseBlock({
            data: fullImageData,
            
            countLeft, countWidth,
            nameLeft, nameWidth,
            
            headerHLine: topHLine1,
            hlines: hlinesTop,
            totalHLine: bottomHLine1,
        });
        
        if (vlineStart == 4) continue;
        
        blockPromises[3+(vlineStart/2)] = DoParseBlock({
            data: fullImageData,
            
            countLeft, countWidth,
            nameLeft, nameWidth,
            
            headerHLine: topHLine2,
            hlines: hlinesBottom,
            totalHLine: bottomHLine2,
        });
    }
    
    const blocks = await Promise.all(blockPromises);
    for (const card of blocks[0].cards) card.indexes = ['monster','spell','trap'];
    for (const card of blocks[1].cards) card.indexes = ['spell','monster','trap'];
    for (const card of blocks[2].cards) card.indexes = ['trap','monster','spell'];
    for (const card of blocks[3].cards) card.indexes = ['monster','spell','trap','extra'];
    for (const card of blocks[4].cards) card.indexes = ['extra'];
    
    CURRENT_PARSE_DATA = blocks;
    
    UpdateIsAllResolved();
    
    for (const block of blocks)
        for (const card of block.cards)
            DoCardSearch(card);

    EnableTicks();
    document.body.className = 'state-ocr';
});

window.SetupOCRFromImageSource = async function(backTo, source)
{
    try
    {
        backButton.backToState = backTo;
        // @todo
    } catch (e) {
        console.error(e);
        StartLoading();
        SetLoadingMessage('Failed: '+e);
        await sleep(5000);
        if (backTo === 'state-choose')
            document.getElementById('pdf-input').value = '';
        document.body.className = backTo;
    }
};

window.SetupOCRFromPDFPage = async function(backTo, page)
{
    try
    {
        ClearLogs(logger);
        backButton.backToState = backTo;
        
        Log(logger, 'Setting up PDF render...');
        
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = (8192/baseViewport.height);
        const viewport = page.getViewport({ scale });
        Log(logger, 'Native: '+baseViewport.width+'px by '+baseViewport.height+'px');
        Log(logger, 'Scaling factor: '+scale.toFixed(2)+'x');
        
        SetLoadingMessage('Rendering PDF...');
        
        SetCanvasDimensions(viewport.width, viewport.height);
        
        const pdfCtx = origCanvas.getContext('2d');
        await page.render({ canvasContext: pdfCtx, viewport: viewport }).promise;
        
        Log(logger, 'Finished rendering.');
        
        return await SetupOCRFromCanvasData(pdfCtx);
    } catch (e) {
        console.error(e);
        StartLoading();
        SetLoadingMessage('Failed: '+e);
        await sleep(5000);
        if (backTo === 'state-choose')
            document.getElementById('pdf-input').value = '';
        document.body.className = backTo;
    }
};

})();
