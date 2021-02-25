let sleep = ((ms) => new Promise((r) => setTimeout(r, ms)));

let Log = ((box, msg, cls) =>
{
    const ctr = document.createElement('span');
    ctr.innerText = (''+msg);
    if (cls) ctr.className = cls;
    box.appendChild(ctr);
});

const autodetect = function(container)
{
    return 'us-pdf';
};

function drawAssignment(assignment, hueMin, hueMax)
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
}

const cmp = {
    topItemsFirst: ((a,b) => (b.item.bottom-a.item.bottom)),
    leftItemsFirst: ((a,b) => (a.item.left-b.item.left)),
};
const parsers = {
    'eu-pdf': ((pdf) =>
    {
        const log = document.getElementById('assign-log');
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
                Log(log, ('Total '+type+' count appears to be '+count.toString().padStart(2)+'.'));
            else
                Log(log, ('Could not find total '+type+' count.'), 'warn');
            
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
                {
                    if (!countElm)
                        continue;
                    const n = parseInt(countElm.item.str);
                    if (!isNaN(n))
                        total += n;
                }
                if (total === count)
                    Log(log, ('Total '+type+' count is '+count+'. Check OK.'));
                else
                    Log(log, ('Total '+type+' expected '+count+', but found '+total+'.'), 'error');
            }
            
            return cards;
        });
        const cutoff = (monLabel.item.bottom-sideLabel.item.bottom);
        return {
            monster: parseFromLabel('Monster', monLabel, cutoff*1.2),
            spell:   parseFromLabel('Spell  ', spellLabel, cutoff*1.2),
            trap:    parseFromLabel('Trap   ', trapLabel, cutoff*1.2),
            side:    parseFromLabel('Side   ', sideLabel, cutoff),
            extra:   parseFromLabel('Extra  ', extraLabel, cutoff),
        };
    }),
    'us-pdf': ((pdf) =>
    {
        const log = document.getElementById('assign-log');
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
                Log(log, ('Total '+type+' count appears to be '+count.toString().padStart(2)+'.'));
            else
                Log(log, ('Could not find total '+type+' count.'), 'warn');
            
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
                {
                    if (!countElm)
                        continue;
                    const n = parseInt(countElm.item.str);
                    if (!isNaN(n))
                        total += n;
                }
                if (total === count)
                    Log(log, ('Total '+type+' count is '+count+'. Check OK.'));
                else
                    Log(log, ('Total '+type+' expected '+count+', but found '+total+'.'), 'error');
            }
            
            return cards;
        });
        const cutoff = (monLabel.item.bottom-sideLabel.item.bottom);
        return {
            monster: parseFromLabel('Monster', monLabel, cutoff*1.2, monLabel),
            spell:   parseFromLabel('Spell  ', spellLabel, cutoff*1.2, spellLabel),
            trap:    parseFromLabel('Trap   ', trapLabel, cutoff*1.2, trapLabel),
            side:    parseFromLabel('Side   ', sideLabel, cutoff, monLabel),
            extra:   parseFromLabel('Extra  ', extraLabel, cutoff, spellLabel),
        };
    }),
};
function assignParse()
{
    const log = document.getElementById('assign-log');
    const alg = document.getElementById('assign-alg').value;
    const parser = parsers[alg];
    if (!parser)
        return;
    Log(log, 'Now parsing using \''+alg+'\'.');
    const data = parser(document.getElementById('pdf-container'));
    
    // data is an object with five keys - monster, spell, trap, side, extra
    // each value is an array of two element arrays [countText, nameText], countText can be null
    Log(log, 'Done parsing.');
    data.main = data.monster.concat(data.spell,data.trap);
    drawAssignment(data.main,     0, 170);
    drawAssignment(data.extra,  200, 250);
    drawAssignment(data.side,   280, 330);
    Log(log, 'Visualized.');
}

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
        container.style.height = '90vmin';
        
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
        
        // try to autodetect the type of pdf
        const pdfType = autodetect(container);
        if (pdfType)
        {
            document.getElementById('assign-alg').value = pdfType;
            Log(logbox, 'Auto-detected form type: \''+pdfType+'\'.');
            assignParse();
        }
    } catch (e) {
        console.error(e);
        Log(logbox, 'Failed: '+e, 'error');
        await sleep(5000);
        document.body.className = 'state-choose';
    }
});

document.body.className = 'state-choose';
