(()=>{

let CURRENT_IDX = null;

const backButton = document.getElementById('decklist-back');
backButton.addEventListener('click', () =>
{
    if (document.body.className !== 'state-decklist')
        return;
    document.body.className = backButton.backToState;
});

const decklistButton = document.getElementById('decklist-decklist');
decklistButton.addEventListener('click', () =>
{
    window.open('https://yugiohdeck.github.io/#'+decklistButton.decklistTag,'_blank').focus();
});

const setupSingleList = ((which, idx, cards, countCheck) =>
{
    const total = cards.length;
    document.getElementById('decklist-count-'+which).innerText = (''+total);
    
    const container = document.getElementById('decklist-container-'+which);
    while (container.lastElementChild)
        container.removeChild(container.lastElementChild);

    let last = null;
    for (const cardId of cards)
    {
        if (cardId === last)
        {
            ++container.lastElementChild.count;
            container.lastElementChild.countElm.innerText = (container.lastElementChild.count + 'x');
            continue;
        }
        last = cardId;
        const elm = document.createElement('span');
        elm.className = 'decklist-card';
        elm.count = 1;
        elm.cardId = cardId;
        
        const countElm = document.createElement('span');
        countElm.className = 'decklist-card-num';
        countElm.innerText = '1x';
        elm.countElm = countElm;
        elm.appendChild(countElm);
        
        const nameElm = document.createElement('span');
        nameElm.className = 'decklist-card-name loading';
        nameElm.innerText = ('<card #'+cardId+' loading>');
        elm.nameElm = nameElm;
        elm.appendChild(nameElm);
        
        container.appendChild(elm);
        (idx[cardId] || (idx[cardId] = [])).push(elm);
    }

    const checkElm = document.getElementById('decklist-check-'+which);
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
window.SetupDeckList = ((backTo, {name: deckName, decks: {main, extra, side}}) =>
{
    backButton.backToState = backTo;
    CURRENT_IDX = null;
    let idx = {};
    setupSingleList('main', idx, main, VALID_MAIN);
    setupSingleList('extra', idx, extra, VALID_EXTRA);
    setupSingleList('side', idx, side, VALID_SIDE);
    CURRENT_IDX = idx;
    document.body.className = 'state-decklist';
    (async ()=>
    {
        const banlistCheck = document.getElementById('decklist-check-banlist');
        banlistCheck.classList.remove('good','bad');
        banlistCheck.title = 'Working...';
        banlistCheck.lastElementChild.innerText = '\u22EF';
        
        const banlistErrors = (await Promise.all(Object.keys(idx).map(async (cardIdStr) =>
        {
            const cardId = +cardIdStr;
            const cardData = (await GetCardData(cardId)).cardData.en;
            const allowed = (
                (!cardData || (cardData.thisSrc.type !== 2)) ? 0 :
                isNaN(cardData.banlistStatus) ? 3 :
                cardData.banlistStatus
            );
            let copies = 0;
            for (const elm of idx[cardId])
            {
                elm.nameElm.innerText = cardData.name;
                elm.nameElm.classList.remove('loading');
                copies += elm.count;
            }
            
            if (allowed < copies)
            {
                const error = (cardData.name+': includes '+copies+', allowed '+allowed);
                for (const elm of idx[cardId])
                {
                    elm.classList.add('error');
                    elm.title = error;
                }
                return error;
            }
        }))).filter((e)=>(e))
        
        if (banlistErrors.length)
        {
            banlistCheck.classList.add('bad')
            banlistCheck.lastElementChild.innerText = '✘\uFE0E';
            banlistCheck.title = banlistErrors.join('\n');
        }
        else
        {
            banlistCheck.classList.add('good');
            banlistCheck.lastElementChild.innerText = '✔\uFE0E';
            banlistCheck.title = '';
        }
    })();
    
    decklistButton.disabled = true;
    decklistButton.value = 'Working…';
    decklistButton.title = '';
    decklistButton.decklistTag = null;
    
    (async ()=>
    {
        const passcodeMap = await GetPasscodesFor(Object.keys(idx).map((k) => (+k)));
        const promises = {}
        for (const which of ['main','extra','side'])
        {
            const thisPromises = [];
            for (const {cardId, count} of document.getElementById('decklist-container-'+which).children)
                thisPromises.push(passcodeMap[cardId].then((c) => [c,count]));
            promises[which] = thisPromises;
        }
        
        const [main, extra, side] = await Promise.all([
            Promise.all(promises.main),
            Promise.all(promises.extra),
            Promise.all(promises.side),
            EnsureScriptLoaded('https://yugiohdeck.github.io/compression.js')
        ]);
        const [mainC, extraC, sideC] = [CompressDeckData(main), CompressDeckData(extra), CompressDeckData(side)];
        
        let tag = mainC;
        if (extraC || sideC)
            tag += (';' + extraC);
        if (sideC)
            tag += (';' + sideC);
        tag += (':'+encodeURIComponent(deckName));
        
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
        decklistButton.disabled = true;
        decklistButton.value = 'Failed 😔\uFE0E';
        decklistButton.title = ('Failed to load decklist link:\n'+e);
    });
});

})();
