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
    await Promise.all(new Array(10).fill().map(async () =>
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


const lumavg = (({data}) => {
    let sum = 0, n = 0;
    for (let i=0; i < data.length; i += 4)
    {
        const l = (data[i+0]*.299 + data[i+1]*.587 + data[i+2]*.114);
        sum += l;
        ++n;
    }
    return (sum / n);
});

const whiteblock = (({data}) => {
    let max = 0, cur = 0;
    for (let i=0; i < data.length; i += 4)
    {
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

const iswhite = ((d) => (lumavg(d) > 252));

const GetTextFromRect = (async (ctx, {left: x, top: y, width: w, height: h}) =>
{
    const data = ctx.getImageData(x+2,y+2,w-4,h-4);
    for (let i=0; i < data.data.length; ++i)
    {
        const l = (data.data[i+0]*.299 + data.data[i+1]*.587 + data.data[i+2]*.114);
        if (l < 15) /* deep black */
        {
            const canvas = document.createElement('canvas');
            canvas.width = data.width;
            canvas.height = data.height;
            canvas.getContext('2d').putImageData(data,0,0);
            
            const result = await OCR(canvas);
            return result.data.text;
        }
    }
    return '';
});

const DoParseBlock = (async ({ctx, countLeft, countWidth, nameLeft, nameWidth, headerHLine, totalHLine, hlines}) =>
{
    const lastHLine = hlines[hlines.length-1];
    
    const headerLeft = countLeft;
    const headerWidth = (nameLeft+nameWidth)-headerLeft;
    const headerTop = headerHLine.start+headerHLine.height;
    const headerHeight = hlines[0].start-headerTop;
    const headerRect = { left: headerLeft, width: headerWidth, top: headerTop, height: headerHeight };
    const headerPromise = GetTextFromRect(ctx, headerRect);
    
    const totalTop = lastHLine.start + lastHLine.height;
    const totalHeight = totalHLine.start - totalTop;
    
    const totalCountRect = { left: countLeft, width: countWidth, top: totalTop, height: totalHeight };
    const totalCountPromise = GetTextFromRect(ctx, totalCountRect);
    
    const totalLabelRect = { left: nameLeft+5, width: nameWidth-5, top: totalTop, height: totalHeight };
    const totalTextPromise = GetTextFromRect(ctx, totalLabelRect);
    
    const cardsData = await Promise.all(new Array(hlines.length-1).fill().map(async (_,i) =>
    {
        const topLine = hlines[i+0];
        const top = topLine.start + topLine.height;
        const bottomLine = hlines[i+1];
        const height = bottomLine.start - top;
        
        const countRect = { left: countLeft, width: countWidth, top, height };
        const countTextPromise = GetTextFromRect(ctx, countRect);
        
        const nameRect = { left: nameLeft,  width: nameWidth,  top, height };
        const nameTextPromise = GetTextFromRect(ctx, nameRect);
        
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
    const origCtx = origCanvas.getContext('2d');
    const {width, height} = origCanvas;
    
    SetLoadingMessage('Tracing image structure...');
    await sleep(0);
    console.log(width,height);
    
    let leftMargin = 0;
    while ((leftMargin < width) && iswhite(origCtx.getImageData(leftMargin, 0, 1, height)))
        ++leftMargin;
    
    let rightMargin = width-1;
    while ((rightMargin > leftMargin) && iswhite(origCtx.getImageData(rightMargin, 0, 1, height)))
        --rightMargin;
    
    let topMargin = 0;
    while ((topMargin < height) && iswhite(origCtx.getImageData(0, topMargin, width, 1)))
        ++topMargin;
    
    let bottomMargin = height-1;
    while ((bottomMargin > topMargin) && iswhite(origCtx.getImageData(0, bottomMargin, width, 1)))
        --bottomMargin;
    
    const marginWidth = (rightMargin+1)-leftMargin;
    const marginHeight = (bottomMargin+1)-topMargin;
    
    // find top horizontal lines (span entire width)
    let hlinesTop = [];
    let currentHLine = null;
    for (let y = topMargin; y < bottomMargin; ++y)
    {
        const data = origCtx.getImageData(leftMargin, y, marginWidth, 1);
        const lum = lumavg(data);
        const white = whiteblock(data);
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
    
    // find vertical lines
    let vlines = [];
    let currentVLine = null;
    const vlineStart = (hlines[0].top + hlines[0].height);
    const vlineHeight = (hlines[hlines.length-1].top - vlineStart);
    for (let x = leftMargin; x < rightMargin; ++x)
    {
        const data = origCtx.getImageData(x, vlineStart, 1, vlineHeight);
        const lum = lumavg(data);
        const white = whiteblock(data);
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
    
    // using the vline pattern (first five vlines are identical), find the bottom roster hlines
    let hlinesBottom = [];
    let currentHLine2 = null;
    const hline2Start = vlines[0].left;
    const hline2Width = vlines[4].left + vlines[4].width - hline2Start;
    for (let y = bottomHLine1.top + bottomHLine1.height; y < bottomMargin; ++y)
    {
        const data = origCtx.getImageData(hline2Start, y, hline2Width, 1);
        const lum = lumavg(data);
        const white = whiteblock(data);
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
    
    let blocks = [null, null, null, null, null];
    for (const vlineStart of [0,2,4])
    {
        const countLeft  = (vlines[vlineStart+0].left + vlines[vlineStart+0].width);
        const countWidth = (vlines[vlineStart+1].left - countLeft);
        const nameLeft   = (vlines[vlineStart+1].left + vlines[vlineStart+1].width);
        const nameWidth  = (vlines[vlineStart+2].left - nameLeft);
        
        blocks[vlineStart+0] = DoParseBlock({
            ctx: origCtx,
            
            countLeft, countWidth,
            nameLeft, nameWidth,
            
            headerHLine: topHLine1,
            hlines: hlinesTop,
            totalHLine: bottomHLine1,
        });
        
        if (vlineStart == 4) continue;
        
        blocks[vlineStart+1] = DoParseBlock({
            ctx: origCtx,
            
            countLeft, countWidth,
            nameLeft, nameWidth,
            
            headerHLine: topHLine2,
            hlines: hlinesBottom,
            totalHLine: bottomHLine2,
        });
    }
    
    SetLoadingMessage('Image structure OK.\nOCR processing...');
    
    const blockData = await Promise.all(blocks);
    console.log(blockData);
});

window.SetupOCRFromImageSource = async function(backTo, source)
{
    try
    {
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