let sleep = ((ms) => new Promise((r) => setTimeout(r, ms)));

let Log = ((box, msg, cls) =>
{
    const ctr = document.createElement('span');
    ctr.innerText = (''+msg);
    if (cls) ctr.className = cls;
    box.insertBefore(ctr, box.firstElementChild);
});

/* ASSIGNMENT PAGE LOGIC START */ (()=>{
    
const logger = document.getElementById('assign-log');

// object with three keys - main, side, extra
// each value is an array of two element arrays [countText, nameText], countText can be null
let CURRENT_ASSIGNMENT = null;

const drawSingle = function(assignment, hueMin, hueMax)
{
    if (!assignment.length)
        return;
    const step = ((hueMax-hueMin)/(assignment.length));
    let hue = (hueMin-(step/2));
    for (const [countText, nameText] of assignment)
    {
        const color = ('hsl('+(hue+=step)+',100%,50%)');
        if (countText !== null)
        {
            countText.classList.add('highlight');
            countText.style.borderColor = color;
        }
        nameText.classList.add('highlight');
        nameText.style.borderColor = color;
    }
};

const drawAssignment = (() =>
{
    for (const elm of document.getElementById('pdf-container').children)
        elm.classList.remove('highlight');
    
    const data = CURRENT_ASSIGNMENT;
    if (!data)
        return;
    drawSingle(data.main,     0, 160);
    drawSingle(data.extra,  185, 245);
    drawSingle(data.side,   275, 335);
});

const elmToCount = ((countElm) =>
{
    if (countElm)
    {
        const n = parseInt(countElm.item.str);
        if (!isNaN(n))
            return n;
    }
    return 1;
});

const autodetect = function(container)
{
    return 'us-pdf';
};

const cmp = {
    topItemsFirst: ((a,b) => (b.item.bottom-a.item.bottom)),
    leftItemsFirst: ((a,b) => (a.item.left-b.item.left)),
};
const parsers = {
    'eu-pdf': ((pdf) =>
    {
        const elms = Array.from(pdf.children);
        const labels = elms.filter((e) => (e.item.str.trim().startsWith('<<<')));
        if (labels.length !== 5)
            throw ('Expected 5 labels, got '+labels.length);
        // sort by y coordinate
        labels.sort(cmp.topItemsFirst);
        // top 3 are monster/spell/trap
        const [monLabel, spellLabel, trapLabel] = [labels[0],labels[1],labels[2]].sort(cmp.leftItemsFirst);
        // bottom 2 are side/extra
        const [sideLabel, extraLabel] = [labels[3],labels[4]].sort(cmp.leftItemsFirst);
        
        const findLeft = ((elm,maxOff) =>
        {
            const left = elms.filter((e) => ((Math.abs(elm.item.bottom-e.item.bottom)*3 < elm.item.height) && (e.item.left < elm.item.left)));
            if (!left.length)
                return null;
            if (left.length > 1)
                left.sort(cmp.leftItemsFirst);
            const target = left[left.length-1];
            if (!isNaN(maxOff) && (target.item.left < (elm.item.left-maxOff)))
                return null;
            return target;
        });
        const parseFromLabel = ((type,label,cutoff) =>
        {
            const countElm = findLeft(label);
            const count = (countElm ? parseInt(countElm.item.str) : 0);
            if (count)
                Log(logger, ('Total '+type+' count appears to be '+count.toString().padStart(2)+'.'));
            else
                Log(logger, ('Could not find total '+type+' count.'), 'warn');
            
            const minY = label.item.bottom;
            const maxY = minY + cutoff;
            
            let cards = elms.filter((e) => ((Math.abs(label.item.left-e.item.left)*1 < label.item.height) && (minY < e.item.bottom) && (e.item.bottom < maxY)));
            
            if (count)
                cards = cards.map((e) => [findLeft(e,(e.item.left-countElm.item.left)*1.25), e]);
            else
                cards = cards.map((e) => [findLeft(e,e.width*1.5), e]);

            if (count)
            {
                let total = 0;
                for (const [countElm,cardElm] of cards)
                    total += elmToCount(countElm);

                if (total === count)
                    Log(logger, ('Total '+type+' count is '+count+'. Check OK.'));
                else
                    Log(logger, ('Total '+type+' expected '+count+', but found '+total+'.'), 'error');
            }
            
            return cards;
        });
        const cutoff = (monLabel.item.bottom-sideLabel.item.bottom);
        return {
            main:  parseFromLabel('Monster', monLabel, cutoff*1.2).concat(
                       parseFromLabel('Spell  ', spellLabel, cutoff*1.2),
                       parseFromLabel('Trap   ', trapLabel, cutoff*1.2)
                   ),
            side:  parseFromLabel('Side   ', sideLabel, cutoff),
            extra: parseFromLabel('Extra  ', extraLabel, cutoff),
        };
    }),
    'us-pdf': ((pdf) =>
    {
        const elms = Array.from(pdf.children);
        const labels = elms.filter((e) => (e.item.str.trim().startsWith('<<<')));
        if (labels.length !== 5)
            throw ('Expected 5 labels, got '+labels.length);
        // sort by y coordinate
        labels.sort(cmp.topItemsFirst);
        // top 3 are monster/spell/trap
        const [monLabel, spellLabel, trapLabel] = [labels[0],labels[1],labels[2]].sort(cmp.leftItemsFirst);
        // bottom 2 are side/extra
        const [sideLabel, extraLabel] = [labels[3],labels[4]].sort(cmp.leftItemsFirst);
        
        const findLeft = ((elm,maxOff) =>
        {
            const left = elms.filter((e) => ((Math.abs(elm.item.bottom-e.item.bottom)*3 < elm.item.height) && (e.item.left < elm.item.left)));
            if (!left.length)
                return null;
            if (left.length > 1)
                left.sort(cmp.leftItemsFirst);
            const target = left[left.length-1];
            if (!isNaN(maxOff) && (target.item.left < (elm.item.left-maxOff)))
                return null;
            return target;
        });
        const parseFromLabel = ((type,label,cutoff,leftLabel) =>
        {
            const countElm = findLeft(label);
            const count = (countElm ? parseInt(countElm.item.str) : 0);
            if (count)
                Log(logger, ('Total '+type+' count appears to be '+count.toString().padStart(2)+'.'));
            else
                Log(logger, ('Could not find total '+type+' count.'), 'warn');
            
            const minY = label.item.bottom;
            const maxY = minY + cutoff;
            
            let cards = elms.filter((e) => ((Math.abs(leftLabel.item.left-e.item.left)*1 < leftLabel.item.height) && (minY < e.item.bottom) && (e.item.bottom < maxY)));
            
            if (count)
                cards = cards.map((e) => [findLeft(e,(e.item.left-countElm.item.left)*1.25), e]);
            else
                cards = cards.map((e) => [findLeft(e,e.width*1.5), e]);

            if (count)
            {
                let total = 0;
                for (const [countElm,cardElm] of cards)
                    total += elmToCount(countElm);

                if (total === count)
                    Log(logger, ('Total '+type+' count is '+count+'. Check OK.'));
                else
                    Log(logger, ('Total '+type+' expected '+count+', but found '+total+'.'), 'error');
            }
            
            return cards;
        });
        const cutoff = (monLabel.item.bottom-sideLabel.item.bottom);
        return {
            main:  parseFromLabel('Monster', monLabel, cutoff*1.2, monLabel).concat(
                       parseFromLabel('Spell  ', spellLabel, cutoff*1.2, spellLabel),
                       parseFromLabel('Trap   ', trapLabel, cutoff*1.2, trapLabel)
                   ),
            side:  parseFromLabel('Side   ', sideLabel, cutoff, monLabel),
            extra: parseFromLabel('Extra  ', extraLabel, cutoff, spellLabel),
        };
    }),
};
const assignParse = function()
{
    const alg = document.getElementById('assign-alg').value;
    const parser = parsers[alg];
    if (parser)
    {
        Log(logger, 'Now parsing using \''+alg+'\'.');
        CURRENT_ASSIGNMENT = parser(document.getElementById('pdf-container'));
        Log(logger, 'Done parsing.');
    }
    else
        CURRENT_ASSIGNMENT = null;
    drawAssignment();
};
document.getElementById('assign-parse').addEventListener('click', assignParse);

document.getElementById('assign-flip').addEventListener('click', () =>
{
    if (!CURRENT_ASSIGNMENT)
    {
        Log(logger, 'There is no current assignment.', 'warn');
        return;
    }
    
    [CURRENT_ASSIGNMENT.side, CURRENT_ASSIGNMENT.extra] = [CURRENT_ASSIGNMENT.extra, CURRENT_ASSIGNMENT.side];
    Log(logger, 'Exchanged Extra & Side Deck.');
    drawAssignment();
});

document.getElementById('assign-close').addEventListener('click', () =>
{
    if (document.body.className !== 'state-assign')
        return;
    CURRENT_ASSIGNMENT = null;
    document.getElementById('pdf-input').value = '';
    document.body.className = 'state-choose';
});

const remapSingle = (([countElm, nameElm]) => [elmToCount(countElm), nameElm.item.str.trim()]);
const assignmentRemap = ((ass) =>
{
    return {
        main: ass.main.map(remapSingle),
        extra: ass.extra.map(remapSingle),
        side: ass.side.map(remapSingle),
    };
});

document.getElementById('assign-next').addEventListener('click', () =>
{
    if (document.body.className !== 'state-assign')
        return;
    if (!CURRENT_ASSIGNMENT)
    {
        Log(logger, 'You have to parse the deck list first!','warn');
        return;
    }
    document.body.className = 'state-namecorrect';
    window.NamecorrectSetup(assignmentRemap(CURRENT_ASSIGNMENT));
});

window.AssignPageSetup = function()
{
    // try to autodetect the type of pdf
    const pdfType = autodetect(document.getElementById('pdf-container'));
    if (pdfType)
    {
        document.getElementById('assign-alg').value = pdfType;
        Log(logger, 'Auto-detected form type: \''+pdfType+'\'.');
        assignParse();
    }
    else
    {
        Log(logger, 'Could not autodetect form type.', 'warn');
    }
};

})(); /* ASSIGMENT PAGE LOGIC END */

/* NAMECORRECT PAGE LOGIC START */ (()=>{
    
const insensitive = ((a) => a.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
const insensitiveEqual = ((a,b) => (insensitive(a) === insensitive(b)));

const tryValidate = (async function(box)
{
    if (box.interval)
        window.clearInterval(box.interval);
    box.loadingText.innerText = 'Searching...';
    const name = box.adjustedText.value;
    const nameIdxs = await window.GetCardNames();
    if (box.adjustedText.value !== name)
        return;
    let match = null;
L1: for (const [locale, nameIdx] of nameIdxs)
    {
        for (const idxName in nameIdx)
        {
            if (insensitiveEqual(idxName, name))
            {
                match = [locale, nameIdx[idxName][0]];
                break L1;
            }
        }
    }
    box.classList.remove('initial','needadj','matched');
    box.searchResultsBox.classList.remove('loading');
    if (match === null)
    {
        box.classList.add('needadj');
        // @todo search results and shit
        return;
    }
    box.classList.add('matched');
    GetPasscodeFor(match[1]); /* preload */
    box.style.backgroundImage = ('url(https://db.ygorganization.com/artwork/'+match[1]+'/1)');
    box.match = match;
});

let intervalTick = null;
intervalTick = ((box) =>
{
    if (--box.intervalTicks)
        box.loadingText.innerText = ('Search in '+box.intervalTicks+'...');
    else
        tryValidate(box);
});

const setInterval = (function()
{
    const box = this.parentElement;
    if (box.interval)
        window.clearInterval(box.interval);
    box.searchResultsBox.classList.add('loading');
    box.intervalTicks = 3;
    box.loadingText.innerText = 'Search in 3...';
    box.interval = window.setInterval(intervalTick, 1000, box);
});

const SetupSingle = ((container, tag, entries) =>
{
    for (const [count, name] of entries)
    {
        const box = document.createElement('div');
        box.className = 'nc-card-box initial';
        container.appendChild(box);
        
        const originalText = document.createElement('span');
        originalText.className = 'nc-orig-text';
        originalText.innerText = name;
        box.appendChild(originalText);
        
        const adjustedText = document.createElement('input');
        adjustedText.className = 'nc-adj-text';
        adjustedText.value = name;
        adjustedText.addEventListener('keyup', (e) => { if (e.keyCode === 13) tryValidate(box) });
        adjustedText.addEventListener('input', setInterval);
        box.appendChild(adjustedText);
        box.adjustedText = adjustedText;
        
        const searchResultsBox = document.createElement('div');
        searchResultsBox.className = 'nc-search-results loading';
        box.appendChild(searchResultsBox);
        box.searchResultsBox = searchResultsBox;
        
        const loadingIcon = document.createElement('img');
        loadingIcon.className = 'nc-load-icon';
        loadingIcon.src = 'img/loading.gif';
        searchResultsBox.appendChild(loadingIcon);
        
        const loadingText = document.createElement('span');
        loadingText.className = 'nc-load-text';
        searchResultsBox.appendChild(loadingText);
        box.loadingText = loadingText;
        
        box.which = tag;
        box.count = count;
        
        tryValidate(box);
    }
});

window.NamecorrectSetup = function(assignment)
{
    const container = document.getElementById('nc-cards-container');
    while (container.lastElementChild)
        container.removeChild(container.lastElementChild);
    
    SetupSingle(container, 'main', assignment.main);
    SetupSingle(container, 'extra', assignment.extra);
    SetupSingle(container, 'side', assignment.side);
};

document.getElementById('nc-back').addEventListener('click', () =>
{
    if (document.body.className !== 'state-namecorrect')
        return;
    document.body.className = 'state-assign';
});

document.getElementById('nc-decklist').addEventListener('click', async () =>
{
    const promises =
    {
        main: [],
        extra: [],
        side: [],
    };
    for (const box of document.getElementById('nc-cards-container').children)
    {
        if (!box.classList.contains('matched'))
        {
            window.alert('At least one card isn\'t resolved, fix that. (Pretty errors NYI.)');
            return;
        }
        promises[box.which].push(GetPasscodeFor(box.match[1]).then((c) => [c,box.count]));
    }
    const [main, extra, side] = await Promise.all([Promise.all(promises.main), Promise.all(promises.extra), Promise.all(promises.side)]);
    console.log(main,extra,side);
    const [mainC, extraC, sideC] = [CompressDeckData(main), CompressDeckData(extra), CompressDeckData(side)];
    
    let tag = mainC;
    if (extraC || sideC)
        tag += (';' + extraC);
    if (sideC)
        tag += (';' + sideC);
    tag += (':'+encodeURIComponent('exported deck naming stuff NYI'));
    window.open('https://yugiohdeck.github.io/#'+tag,'_blank').focus();
});

})(); /* NAMECORRECT PAGE LOGIC END */

document.getElementById('pdf-input').value = '';
document.getElementById('pdf-input').addEventListener('change', async function()
{
    if (!this.files.length)
        return;
    if (document.body.className !== 'state-choose')
        return;
        
    const logbox = document.getElementById('assign-log');
    while (logbox.lastElementChild)
        logbox.removeChild(logbox.lastElementChild);

    document.body.className = 'state-assign';

    try
    {
        const file = await this.files[0].arrayBuffer();
        const PDFJS = window.pdfjsLib;
        PDFJS.GlobalWorkerOptions.workerSrc = 'include/pdf.worker.js';
        const pdf = await PDFJS.getDocument(file).promise;
        const page = await pdf.getPage(1);
        console.log(pdf,page);
        
        const container = document.getElementById('pdf-container');
        while (container.lastElementChild)
            container.removeChild(container.lastElementChild);
        
        // we normalize the container to always be 90vmin in content height
        // this is the scaling factor of page pixels to vmin
        const scalingFactor = (90/page.view[3]);
        container.style.width = ((page.view[2]*scalingFactor)+'vmin');
        
        // render text boxes
        const textContent = await page.getTextContent();
        for (const item of textContent.items)
        {
            const box = document.createElement('span');
            box.className = 'pdf-element';
            box.style.left = ((item.transform[4]*scalingFactor)+'vmin');
            box.style.bottom = ((item.transform[5]*scalingFactor)+'vmin');
            box.style.fontFamily = (item.fontName + ', ' + textContent.styles[item.fontName].fontFamily);
            box.style.fontSize = ((item.transform[0]*scalingFactor)+'vmin');
            box.innerText = item.str;
            box.item = { str: item.str, left: item.transform[4], bottom: item.transform[5], height: item.transform[0] };
            container.appendChild(box);
        }
        
        const annotations = await page.getAnnotations();
        for (const item of annotations)
        {
            if (item.fieldType !== 'Tx')
                continue;
            if (!item.fieldValue)
                continue;
            console.log(item);
            const box = document.createElement('span');
            box.className = 'pdf-element';
            const padding = item.borderStyle.dashArray[0];
            box.item = { str: item.fieldValue, left: item.rect[0]+padding, bottom: item.rect[1]+padding, height: (item.rect[3]-item.rect[1])-2*padding, width: (item.rect[2]-item.rect[0])-2*padding };
            box.style.left = ((box.item.left*scalingFactor)+'vmin');
            box.style.bottom = ((box.item.bottom*scalingFactor)+'vmin');
            box.style.width = ((box.item.width*scalingFactor)+'vmin');
            box.style.height = ((box.item.height*scalingFactor)+'vmin');
            box.style.fontFamily = 'Helvetica, Arial, sans-serif;';
            box.style.fontSize = ((box.item.height*scalingFactor)+'vmin');
            box.innerText = item.fieldValue;
            container.appendChild(box);
        }
        
        window.AssignPageSetup();
    } catch (e) {
        console.error(e);
        Log(logbox, 'Failed: '+e, 'error');
        await sleep(5000);
        document.body.className = 'state-choose';
    }
});

document.body.className = 'state-choose';
