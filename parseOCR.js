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

const backButton = document.getElementById('ocr-back');
const nextButton = document.getElementById('ocr-next');

backButton.addEventListener('click', () =>
{
    if (document.body.className !== 'state-ocr')
        return;

    const backTo = backButton.backToState;
    if (backTo === 'state-choose')
        document.getElementById('pdf-input').value = '';
    document.body.className = backTo;
});

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
    
    const pixelData = imageData.data;
    const totalWidth = imageData.width;
    for (let y = top+2, maxY = top+height-2; y < maxY; ++y) for (let x = left+2, maxX = left+width-2; x < maxX; ++x) /* 2px margins */
    {
        const i = 4*(x + y*totalWidth);
        const l = (pixelData[i+0]*.299 + pixelData[i+1]*.587 + pixelData[i+2]*.114);
        if (l < 15) /* deep black */
        {
            try
            {
                const canvas = document.createElement('canvas');
                canvas.width = width-4;
                canvas.height = height-4;
                canvas.getContext('2d').drawImage(origCanvas, left+2, top+2, width-4, height-4, 0, 0, canvas.width, canvas.height);
                
                const result = await OCR(canvas);
                return result.data.text;
            } finally {
                ++rectCountComplete;
                SetLoadingMessage('OCR processing...\n'+(rectCountComplete*100/rectCountTotal).toFixed(0)+'% complete');
            }
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
        
        const count = parseInt(await countTextPromise);
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
    
    SetLoadingMessage('Tracing image structure...\nGetting image data...');
    await sleep(0);
    origCtx.fillRect(0,0,0,0); /* firefox bug workaround */
    const fullImageData = origCtx.getImageData(0, 0, width, height);
    origCtx = null;
    
    SetLoadingMessage('Tracing image structure...\nFinding margins...');
    await sleep(0);
    
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
    
    SetLoadingMessage('Tracing image structure...\nFinding horizontal lines...');
    await sleep(0);
    
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
    
    const topHLine1 = hlinesTop.shift();
    const bottomHLine1 = hlinesTop.pop();
    
    // assert hline pattern - top and bottom line are bolded, rest is regular height
    if (topHLine1.height < 17)
        throw ('First hline found at y='+topHLine1.top+' not expected height, expected >=17, got '+topHLine1.height);
    if (bottomHLine1.height < 17)
        throw ('Last hline found at y='+bottomHLine1.top+' not expected height, expected >=17, got '+bottomHLine1.height);
    for (const {top,height} of hlinesTop)
        if (height > 12)
            throw ('Middle hline found at y='+top+' not expected height, expected <= 12, got '+height);
    
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
    
    // assert vline pattern - there should be seven in total: bold, narrow, bold, narrow, bold, narrow, bold
    if (vlines.length !== 7)
        throw ('Unexpected number of vlines; expected 7, got '+vlines.length);
    for (let i=0; i<7; i+=2)
        if (vlines[i].width < 17)
            throw ('Odd vline at i='+i+' is too narrow, expected width >= 17, got '+vlines[i].width+' instead');
    for (let i=1; i<7; i+=2)
        if (vlines[i].width > 12)
            throw ('Even vline at i='+i+' is too wide, expected width <= 12, got '+vlines[i].width+' instead');
    
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

    const topHLine2 = hlinesBottom.shift();
    const bottomHLine2 = hlinesBottom.pop();
    
    // assert hline pattern - top is bolded (as it should be), but for some reason the bottom isn't along the entire line (gg konami)
    if (topHLine2.height < 17)
        throw ('First hline found at y='+topHLine2.top+' not expected height, expected >=17, got '+topHLine2.height);
    if ((bottomHLine2.height < 17) && (bottomHLine2.height > 12))
        throw ('Last hline found at y='+bottomHLine2.top+' not expected height, expected >=17 or <=12, got '+bottomHLine2.height);
    for (const {top,height} of hlinesBottom)
        if (height > 12)
            throw ('Middle hline found at y='+top+' not expected height, expected <= 12, got '+height);
    
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
    console.log(blocks);
    Log(logger, 'This is an in-progress tech demo of OCR parsing. Visual feedback and data correction NYI. \'Confirm\' does nothing right now.');
    Log(logger, 'Anyway, here is what we think we saw in the data. Your browser console has the whole thing.');
    for (const block of blocks)
    {
        Log(logger, ' ');
        Log(logger, '=== '+block.header.toUpperCase());
        Log(logger, '== '+block.totalCount+' card(s) total');
        for (const card of block.cards)
        {
            if (isNaN(card.count) && !card.name) continue;
            Log(logger, card.count+'x '+card.name);
        }
    }
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
        backButton.backToState = backTo;
        
        const baseViewport = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: (8192/baseViewport.height) });
        
        SetLoadingMessage('Rendering PDF...');
        
        SetCanvasDimensions(viewport.width, viewport.height);
        
        const pdfCtx = origCanvas.getContext('2d');
        await page.render({ canvasContext: pdfCtx, viewport: viewport }).promise;
        
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
