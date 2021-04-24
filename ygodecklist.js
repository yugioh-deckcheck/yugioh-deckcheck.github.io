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
// each value is an array of two element arrays [countText, nameText], countText can be falsey
let CURRENT_ASSIGNMENT = null;

const drawSingle = function(assignment, name, hueMin, hueMax)
{
    if (!assignment.length)
        return;
    const step = ((hueMax-hueMin)/(assignment.length));
    let hue = (hueMin-(step/2));
    let minLeft = Number.POSITIVE_INFINITY;
    let maxRight = Number.NEGATIVE_INFINITY;
    let minTop = Number.POSITIVE_INFINITY;
    let maxBottom = Number.NEGATIVE_INFINITY;
    for (const [countText, nameTexts] of assignment)
    {
        const minmax = ((elm) =>
        {
            minLeft = Math.min(minLeft, elm.offsetLeft);
            maxRight = Math.max(maxRight, elm.offsetLeft+elm.offsetWidth);
            minTop = Math.min(minTop, elm.offsetTop);
            maxBottom = Math.max(maxBottom, elm.offsetTop+elm.offsetHeight);
        });
        
        const color = ('hsl('+(hue+=step)+',100%,50%)');
        if (countText)
        {
            countText.classList.add('highlight');
            countText.style.borderColor = color;
            minmax(countText);
        }
        for (const nameText of nameTexts)
        {
            nameText.classList.add('highlight');
            nameText.style.borderColor = color;
            minmax(nameText);
        }
    }
    
    const id = ('pdf-marker-'+name.toLowerCase());
    let marker = document.getElementById(id);
    if (isFinite(minLeft))
    {
        const container = document.getElementById('pdf-container');
        if (!marker)
        {
            marker = document.createElement('div');
            marker.id = id;
            marker.innerText = (name+' Deck');
            container.appendChild(marker);
        }
        marker.style.left = ((((minLeft/container.scrollWidth)*100)-1)+'%');
        marker.style.width = (((((maxRight-minLeft)/container.scrollWidth)*100)+2)+'%');
        marker.style.top = ((((minTop/container.scrollHeight)*100)-4)+'%');
        marker.style.height = (((((maxBottom-minTop)/container.scrollHeight)*100)+5)+'%');
    }
    else if (marker)
        marker.parentElement.removeChild(marker);
};

const drawAssignment = (() =>
{
    for (const elm of document.getElementById('pdf-container').children)
        elm.classList.remove('highlight');
    
    const checks = document.getElementById('assign-checks').children;
    const data = CURRENT_ASSIGNMENT;
    
    for (const elm of checks)
    {
        if (elm.dataset.tag)
        {
            elm.classList.remove('good','bad');
            elm.lastElementChild.innerText = '❓\uFE0E';
        }
    }

    if (!data)
        return;
    drawSingle(data.main,   'Main',    0, 160);
    drawSingle(data.extra,  'Extra', 185, 245);
    drawSingle(data.side,   'Side',  275, 335);
    
    for (const elm of checks)
    {
        const v = data.checks[elm.dataset.tag];
        if (v === true)
        {
            elm.classList.add('good');
            elm.lastElementChild.innerText = '✔\uFE0E';
        }
        else if (v === false)
        {
            elm.classList.add('bad');
            elm.lastElementChild.innerText = '✘\uFE0E';
        }
    }
});

const elmToCount = ((countElm) =>
{
    if (countElm)
    {
        const n = parseInt(countElm.info.str);
        if (!isNaN(n))
            return n;
    }
    return 1;
});

const cmp = {
    topItemsFirst: ((a,b) => (b.info.bottom-a.info.bottom)),
    leftItemsFirst: ((a,b) => (a.info.left-b.info.left)),
};
const parsers = {
    'pdf-editable': ((pdf) =>
    {
        const elms = Array.from(pdf.children).filter((e) => e.classList.contains('pdf-element'));
        const anns = {};
        for (const elm of elms)
        {
            const ann = elm.annotation;
            if (!ann)
                continue;
            if (ann)
                anns[ann.fieldName.toLowerCase()] = elm;
        }
        const parseSingle = ((tag,totalName) => {
            const countElm = anns[totalName];
            if (!countElm) throw ('Missing total elm: '+totalName);
            const count = parseInt(countElm.info.str);
            
            let res = [];
            let total = 0;
            for (let i=1; i<60; ++i)
            {
                const cardNameElm = anns[tag+' '+i+' name'];
                if (!cardNameElm)
                    continue;
                const cardNumElm = anns[tag+' '+i+' number'];
                res.push([cardNumElm, [cardNameElm]]);
                total += elmToCount(cardNumElm);
            }
            if (total === count)
                return { cards: res, countOK: true };
            else if (count === 0)
                return { cards: res };
            else
                return { cards: res, countOK: false };
        });
        
        const nameElm = anns['full name'];
        const eventElm = anns['event name'];
        const [monster,spell,trap,side,extra] = [
            parseSingle('mon','total mon cards'),
            parseSingle('spell','total spell cards'),
            parseSingle('trap','total trap cards'),
            parseSingle('side','total side number'),
            parseSingle('extra','total extra deck'),
        ];
        return {
            playerName: nameElm && nameElm.info.str,
            eventName: eventElm && eventElm.info.str,
            main: monster.cards.concat(spell.cards, trap.cards),
            extra: extra.cards,
            side: side.cards,
            checks: {
                monsterCount: monster.countOK,
                spellCount:   spell.countOK,
                trapCount:    trap.countOK,
                extraCount:   extra.countOK,
                sideCount:    side.countOK,
            },
        };
    }),
    'pdf-text': ((pdf) =>
    {
        const elms = Array.from(pdf.children).filter((e) => e.classList.contains('pdf-element'));
        let labels = elms.filter((e) => (e.info.str.trim().startsWith('<<<')));
        if (labels.length !== 5)
        {
            if (labels.length)
                throw ('Failed to find labels. Expected 5 labels, got '+labels.length);
            Log(logger, 'Falling back to single-glyph parsing.');
            labels = elms.filter((e) => (e.info.str === '<'));
            if (labels.length !== 15)
                throw ('Fallback failed. Expected 15 \'<\' characters, got '+labels.length);
            labels.sort(cmp.topItemsFirst);
            labels.sort(cmp.leftItemsFirst);
            labels = [labels[0], labels[3], labels[6], labels[9], labels[12]];
        }
        // sort by y coordinate
        labels.sort(cmp.topItemsFirst);
        // top 3 are monster/spell/trap
        const [monLabel, spellLabel, trapLabel] = [labels[0],labels[1],labels[2]].sort(cmp.leftItemsFirst);
        // bottom 2 are side/extra
        const [sideLabel, extraLabel] = [labels[3],labels[4]].sort(cmp.leftItemsFirst);
        
        const findLeft = ((elm,maxOff) =>
        {
            if (isNaN(maxOff))
                maxOff = 0;
            const sign = (maxOff >= 0) ? 1 : -1;
            const left = elms.filter((e) => ((Math.abs(elm.info.bottom-e.info.bottom)*3 < elm.info.height) && (Math.sign(elm.info.left-e.info.left) === sign)));
            if (!left.length)
                return null;
            if (left.length > 1)
                left.sort(cmp.leftItemsFirst);
            if (maxOff >= 0)
            {
                const target = left[left.length-1];
                if (maxOff && (target.info.left < (elm.info.left-maxOff)))
                    return null;
                return target;
            }
            else
            {
                const target = left[0];
                if (elm.info.left-maxOff < target.info.left)
                    return null;
                return target;
            }
        });
        const findExtras = ((e) =>
        {
            let es = [e];
            while (true)
            {
                const el = findLeft(e, Number.NEGATIVE_INFINITY);
                if (!el || (e.info.height !== el.info.height))
                    break;
                if ((e.offsetLeft + e.offsetWidth) < (el.offsetLeft-10))
                    break;
                es.push((e = el));
            }
            return es;
        });
        const parseFromLabel = ((label,cutoff,leftLabel) =>
        {
            const countElm = findLeft(label);
            const count = (countElm ? parseInt(countElm.info.str) : 0);
            const minY = label.info.bottom;
            const maxY = minY + cutoff;
            
            let cards = elms.filter((e) => ((Math.abs(leftLabel.info.left-e.info.left)*1 < leftLabel.info.height) && (minY < e.info.bottom) && (e.info.bottom < maxY)));
            
            if (count)
                cards = cards.map((e) => [findLeft(e,(e.info.left-countElm.info.left)*1.25), findExtras(e)]);
            else
                cards = cards.map((e) => [findLeft(e,e.width*1.5), findExtras(e)]);

            let total = 0;
            for (const [countElm,cardElm] of cards)
                total += elmToCount(countElm);

            if (total === count)
                return { cards: cards, countOK: true };
            else if (count === 0)
                return { cards: cards };
            else
                return { cards: cards, countOK : false };
        });
        
        const cutoff = (monLabel.info.bottom-sideLabel.info.bottom);
        const [monster,spell,trap,side,extra] = [
            parseFromLabel(monLabel, cutoff*1.05, monLabel),
            parseFromLabel(spellLabel, cutoff*1.05, spellLabel),
            parseFromLabel(trapLabel, cutoff*1.05, trapLabel),
            parseFromLabel(sideLabel, cutoff, monLabel),
            parseFromLabel(extraLabel, cutoff, spellLabel)
        ];
        return {
            main: monster.cards.concat(spell.cards, trap.cards),
            extra: extra.cards,
            side: side.cards,
            checks: {
                monsterCount: monster.countOK,
                spellCount:   spell.countOK,
                trapCount:    trap.countOK,
                extraCount:   extra.countOK,
                sideCount:    side.countOK,
            },
        };
    }),
};
document.getElementById('assign-parse').addEventListener('click', () =>
{
    const alg = document.getElementById('assign-alg').value;
    Log(logger, 'Now parsing using \''+alg+'\'.');
    try
    {
        CURRENT_ASSIGNMENT = parsers[alg](document.getElementById('pdf-container'));
        Log(logger, 'Done parsing.');
    } catch (e) {
        console.error(e);
        Log(logger, ('\''+alg+'\' parsing failed.'), 'warn');
        CURRENT_ASSIGNMENT = null;
    }
    drawAssignment();
});

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

const remapSingle = (([countElm, nameElms]) => [elmToCount(countElm), nameElms.map((elm) => elm.info.str.trim()).join(' ')]);
const assignmentRemap = ((ass) =>
{
    return {
        name: (!ass.playerName ? 'Exported Deck' : !ass.eventName ? ('Exported Deck – '+ass.playerName) : (ass.eventName+' – '+ass.playerName)),
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
    document.body.className = 'state-loading';
    window.NamecorrectSetup(assignmentRemap(CURRENT_ASSIGNMENT));
});

window.AssignPageSetup = function(width, height, textContent, annotations)
{
    const container = document.getElementById('pdf-container');
    while (container.lastElementChild)
        container.removeChild(container.lastElementChild);
    
    // we normalize the container to always be 90vmin in content height
    // this is the scaling factor of page pixels to vmin
    const scalingFactor = (90/height);
    container.scalingFactor = scalingFactor;
    container.style.width = ((width*scalingFactor)+'vmin');
    
    // render text boxes
    for (const item of textContent.items)
    {
        const box = document.createElement('span');
        box.className = 'pdf-element';
        box.style.left = ((item.transform[4]*scalingFactor)+'vmin');
        box.style.bottom = ((item.transform[5]*scalingFactor)+'vmin');
        box.style.fontFamily = (item.fontName + ', ' + textContent.styles[item.fontName].fontFamily);
        box.style.fontSize = ((item.transform[0]*scalingFactor)+'vmin');
        box.innerText = item.str;
        box.info = { str: item.str, left: item.transform[4], bottom: item.transform[5], height: item.transform[0] };
        container.appendChild(box);
    }
    
    // render annotations
    for (const item of annotations)
    {
        if (item.fieldType !== 'Tx')
            continue;
        if (!item.fieldValue)
            continue;
        const box = document.createElement('span');
        box.className = 'pdf-element';
        const padding = item.borderStyle.dashArray[0];
        box.info = { str: item.fieldValue, left: item.rect[0]+padding, bottom: item.rect[1]+padding, height: (item.rect[3]-item.rect[1])-2*padding, width: (item.rect[2]-item.rect[0])-2*padding };
        box.annotation = item;
        box.style.left = ((box.info.left*scalingFactor)+'vmin');
        box.style.bottom = ((box.info.bottom*scalingFactor)+'vmin');
        box.style.width = ((box.info.width*scalingFactor)+'vmin');
        box.style.height = ((box.info.height*scalingFactor)+'vmin');
        box.style.fontFamily = 'Helvetica, Arial, sans-serif;';
        box.style.fontSize = ((box.info.height*scalingFactor)+'vmin');
        box.innerText = item.fieldValue;
        container.appendChild(box);
    }
    
    document.body.className = 'state-assign';

    // try to autodetect the type of pdf
    found : {
        for (const pdfType in parsers)
        {
            try
            {
                CURRENT_ASSIGNMENT = parsers[pdfType](container);
            } catch (e) {
                console.warn(pdfType+' failed to parse:', e);
                while (logger.lastElementChild)
                    logger.removeChild(logger.lastElementChild);
                continue;
            }
            drawAssignment();
            Log(logger, 'Auto-detected form type: \''+pdfType+'\'.');
            document.getElementById('assign-alg').value = pdfType;
            break found;
        }
        Log(logger, 'Failed to auto-detect form type.', 'warn');
        CURRENT_ASSIGNMENT = null;
        drawAssignment();
    }
};

})(); /* ASSIGMENT PAGE LOGIC END */

/* NAMECORRECT PAGE LOGIC START */ (()=>{

let deckName = 'Exported Deck';
let _banlistCheckTimeout = 0;   
const DoBanlistCheck = (() =>
{
    window.clearTimeout(_banlistCheckTimeout);
    const banlistCheck = document.getElementById('nc-check-banlist');
    banlistCheck.classList.remove('good','bad');
    banlistCheck.title = 'Working...';
    banlistCheck.lastElementChild.innerText = '\u22EF';
    
    const decklistButton = document.getElementById('nc-decklist')
    decklistButton.disabled = true;
    decklistButton.value = 'To Decklist';
    decklistButton.title = 'Resolve all the unidentified cards on the left first!';
    
    const counts = {}
    for (const box of document.getElementById('nc-cards-container').children)
    {
        if (!box.classList.contains('matched'))
        {
            banlistCheck.classList.remove('good','bad');
            banlistCheck.title = 'Please resolve all cards first!';
            banlistCheck.lastElementChild.innerText = '';
            return;
        }
        counts[box.matchedCardId] = ((counts[box.matchedCardId] || 0) + box.count);
    }
    
    (async () =>
    {
        const errors = (await Promise.all(Object.entries(counts).map(async ([id,count]) =>
        {
            const cardData = (await GetCardData(id)).cardData.en;
            const banStatus = cardData.banlistStatus;
            const allowed = (isNaN(banStatus) ? 3 : banStatus);
            if (allowed < count)
                return (cardData.name + ': includes '+count+', allowed '+allowed);
        }))).filter((e)=>(e));
        
        if (errors.length)
        {
            banlistCheck.classList.add('bad')
            banlistCheck.lastElementChild.innerText = '✘\uFE0E';
            banlistCheck.title = errors.join('\n');
        }
        else
        {
            banlistCheck.classList.add('good');
            banlistCheck.lastElementChild.innerText = '✔\uFE0E';
            banlistCheck.title = '';
        }
    })();
    
    decklistButton.value = '\u22EF';
    (async () =>
    {
        const cardIds = [];
        for (const box of document.getElementById('nc-cards-container').children)
            cardIds.push(box.matchedCardId);
        
        const passcodeMap = await GetPasscodesFor(cardIds);
        const promises = { main: [], extra: [], side: [] };
        for (const box of document.getElementById('nc-cards-container').children)
            promises[box.which].push(passcodeMap[box.matchedCardId].then((c) => [c,box.count]));
        
        const [main, extra, side] = await Promise.all([Promise.all(promises.main), Promise.all(promises.extra), Promise.all(promises.side)]);
        const [mainC, extraC, sideC] = [CompressDeckData(main), CompressDeckData(extra), CompressDeckData(side)];
        
        let tag = mainC;
        if (extraC || sideC)
            tag += (';' + extraC);
        if (sideC)
            tag += (';' + sideC);
        tag += (':'+encodeURIComponent(deckName));
        
        const decklistButton = document.getElementById('nc-decklist');
        decklistButton.disabled = false;
        decklistButton.value = 'To Decklist';
        decklistButton.title = '';
        decklistButton.decklistTag = tag;
    })().catch((e) =>
    {
        console.error(e);
        if (e instanceof TypeError)
            e = 'Are we allowed to load data from db.ygoprodeck.com?';
        if (e instanceof ReferenceError)
            e = 'Are we allowed to load scripts from yugiohdeck.github.io?';
        const decklistButton = document.getElementById('nc-decklist');
        decklistButton.disabled = true;
        decklistButton.value = 'To Decklist';
        decklistButton.title = ('Failed to load decklist link:\n'+e);
    });
});
const ScheduleBanlistCheck = (() =>
{
    window.clearTimeout(_banlistCheckTimeout);
    _banlistCheckTimeout = window.setTimeout(DoBanlistCheck, 250);
});

const distanceScore = ((a,b,cutoff) =>
{
    const lenA = a.length, lenB = b.length;
    const lenDelta = Math.abs(lenA-lenB);
    
    if (a === b)
        return 0;
    
    if (b.includes(a))
        return 1-lenA/lenB;
        
    if (lenDelta >= cutoff)
        return cutoff;

    let data = Array(lenA+1).fill().map(() => Array(lenB+1));
    for (let i=0; i <= lenA; ++i)
        data[i][0] = i;
    for (let j=0; j <= lenB; ++j)
        data[0][j] = j;
    
    for (let i=1; i <= lenA; ++i)
    {
        let stop = true;
        for (let j=1; j <= lenB; ++j)
        {
            let c = +(a.charAt(i-1) !== b.charAt(j-1));
            data[i][j] = Math.min(data[i-1][j]  +1,
                                  data[i][j-1]  +1,
                                  data[i-1][j-1]+c);

            if ((1<i) && (j<1) && (a.charAt(i-1) === b.charAt(j-2)) && (a.charAt(i-2) === b.charAt(j-1)))
                data[i][j] = Math.min(data[i][j], data[i-2][j-2]+c);
            if (data[i][j] < cutoff)
                stop = false;
        }
        if (stop)
            return cutoff;
    }
    return data[lenA][lenB];
});  

const setBoxMatch = ((box, locale, id) =>
{
    box.className = 'nc-card-box matched';
    box.searchResultsBox.className = 'nc-search-results';
    box.matchedCardLocale = locale;
    box.matchedCardId = id;

    ScheduleBanlistCheck();
    
    const background = ('url(https://db.ygorganization.com/artwork/'+id+'/1)');
    switch (box.count)
    {
        case 1:
            box.style.backgroundImage = background;
            box.style.backgroundPosition = '1.1vw 15%';
            break;
        case 2:
            box.style.backgroundImage = (background+','+background);
            box.style.backgroundPosition = '0.8vw 15%, 1.4vw 15%';
            break;
        case 3:
            box.style.backgroundImage = (background+','+background+','+background);
            box.style.backgroundPosition = '0.5vw 15%, 1.1vw 15%, 1.7vw 15%';
            break;
    }
});

const tryValidate = (async function(box)
{
    const token = {};
    box.token = token;
    if (box.interval)
        window.clearInterval(box.interval);
    box.classList.remove('with-edit-box');
    box.loadingText.innerText = 'Searching... (0%)';
    const name = box.adjustedText.value;
    const nameIdx = await window.GetCardNameIndex();
    const nameIdxs = await window.GetCardNames();
    const extraDeckCards = await window.GetExtraDeckCards();
    if (token !== box.token)
        return;
        
    const isValidFor = ((box, id) =>
    {
        switch (box.which)
        {
            case 'main':
                return !extraDeckCards.has(id);
            case 'extra':
                return extraDeckCards.has(id);
            default:
                return true;
        }
    });

    const exactMatch = nameIdx[window.NormalizeNameStrict(name)];
    if (exactMatch && isValidFor(box, exactMatch[1]))
    {
        setBoxMatch(box, exactMatch[0], exactMatch[1]);
        return;
    }

    let matches = [];
    const searchName = window.NormalizeNameLax(name);

    const nIdxs = nameIdxs.length;
    for (let iIdxs=0; iIdxs<nIdxs; ++iIdxs)
    {
        const [locale, nameIdx] = nameIdxs[iIdxs];
        const nIdx=nameIdx.length;
        for (let iIdx=0; iIdx<nIdx; ++iIdx)
        {
            if (!(iIdx % 1000))
            {
                const progress = (((iIdxs/nIdxs)+(iIdx/nIdx/nIdxs))*100).toFixed(1);
                box.loadingText.innerText = 'Searching... ('+progress+'%)';
                await sleep(0);
                if (token !== box.token)
                    return;
            }
            
            const [idxId,idxName] = nameIdx[iIdx];
            
            if (!isValidFor(box, idxId))
                continue;

            const score = distanceScore(searchName, idxName, 4);
            if (score < 4)
                matches.push([locale, idxId, score]);
        }
    }
    box.className = 'nc-card-box';
    box.loadingText.innerText = 'Processing...';
    box.classList.add('needadj');
    matches.sort((a,b) => (a[2]-b[2]));
    let data = [];
    for (let i=0; i<Math.min(matches.length,10); ++i)
    {
        const [locale,id] = matches[i];
        data.push(GetCardData(id).then((d) => [locale,id,d.cardData[locale].name]));
    }
    data = await Promise.all(data);
    if (token !== box.token)
        return;
    
    while (box.searchResultsContainer.lastElementChild)
        box.searchResultsContainer.removeChild(box.searchResultsContainer.lastElementChild);

    for (const [locale,id,name] of data)
    {
        const result = document.createElement('div');
        result.className = 'nc-search-result';
        result.title = name;
        result.addEventListener('click', () => { setBoxMatch(box, locale, id); });
        
        const flag = document.createElement('img');
        flag.className = 'nc-search-result-flag';
        flag.src = ('img/locale_'+locale+'.png');
        result.appendChild(flag);
        
        const label = document.createElement('span');
        label.className = 'nc-search-result-name';
        label.innerText = name;
        result.appendChild(label);
        
        box.searchResultsContainer.appendChild(result);
    }
    box.searchResultsBox.className = 'nc-search-results has-results';
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
    box.searchResultsBox.className = 'nc-search-results loading';
    box.token = null;
    box.intervalTicks = 3;
    box.loadingText.innerText = 'Search in 3...';
    box.interval = window.setInterval(intervalTick, 1000, box);
});

const SetupSingle = ((container, tag, entries, countCheck) =>
{
    let total = 0;
    for (const [count, name] of entries)
    {
        const box = document.createElement('div');
        box.className = 'nc-card-box initial';
        container.appendChild(box);
        
        const originalText = document.createElement('span');
        originalText.className = 'nc-orig-text';
        originalText.innerText = name;
        originalText.title = name;
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
        
        const searchResultsContainer = document.createElement('div');
        searchResultsContainer.className = 'nc-search-results-container';
        searchResultsBox.appendChild(searchResultsContainer);
        box.searchResultsContainer = searchResultsContainer;
        
        const searchResultsOther = document.createElement('span');
        searchResultsOther.className = 'nc-search-results-other';
        searchResultsOther.innerText = 'Edit...';
        searchResultsBox.appendChild(searchResultsOther);
        searchResultsOther.addEventListener('click', () => { box.classList.add('with-edit-box'); });
        
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
        total += count;
        
        tryValidate(box);
    }
    
    const checkElm = document.getElementById('nc-check-'+tag);
    checkElm.classList.remove('good','bad');
    if (countCheck(total))
    {
        checkElm.classList.add('good');
        checkElm.lastElementChild.innerText = '✔\uFE0E';
    }
    else
    {
        checkElm.classList.add('bad');
        checkElm.lastElementChild.innerText = (''+total);
    }
});

const VALID_MAIN = ((c) => ((40 <= c) && (c <= 60)));
const VALID_EXTRA = ((c) => ((c === 0) || (c === 15)));
const VALID_SIDE = ((c) => (c === 15));
window.NamecorrectSetup = function(assignment)
{
    deckName = assignment.name;
    const container = document.getElementById('nc-cards-container');
    while (container.lastElementChild)
        container.removeChild(container.lastElementChild);
    
    SetupSingle(container, 'main', assignment.main, VALID_MAIN);
    SetupSingle(container, 'extra', assignment.extra, VALID_EXTRA);
    SetupSingle(container, 'side', assignment.side, VALID_SIDE);
    
    DoBanlistCheck();
    
    document.body.className = 'state-namecorrect';
};

document.getElementById('nc-back').addEventListener('click', () =>
{
    if (document.body.className !== 'state-namecorrect')
        return;
    document.body.className = 'state-assign';
});

document.getElementById('nc-decklist').addEventListener('click', function()
{
    window.open('https://yugiohdeck.github.io/#'+this.decklistTag,'_blank').focus();
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

    document.body.className = 'state-loading';

    try
    {
        const file = await this.files[0].arrayBuffer();
        const PDFJS = window.pdfjsLib;
        PDFJS.GlobalWorkerOptions.workerSrc = 'include/pdf.worker.js';
        const pdf = await PDFJS.getDocument(file).promise;
        const page = await pdf.getPage(1);
        const [textContent, annotations] = await Promise.all([page.getTextContent(), page.getAnnotations()]);
        window.AssignPageSetup(page.view[2], page.view[3], textContent, annotations);
    } catch (e) {
        console.error(e);
        Log(logbox, 'Failed: '+e, 'error');
        await sleep(5000);
        document.body.className = 'state-choose';
    }
});

document.body.className = 'state-choose';
window.clearTimeout(window.noasyncTimeout);
