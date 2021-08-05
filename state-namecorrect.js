(()=>{

const backButton = document.getElementById('nc-back');
const nextButton = document.getElementById('nc-next');

let deckName = 'Exported Deck';
let _banlistCheckTimeout = 0;   
const DoBanlistCheck = (() =>
{
    window.clearTimeout(_banlistCheckTimeout);
    
    nextButton.disabled = true;
    nextButton.value = '-';
    nextButton.title = 'Resolve all the unidentified cards on the left first!';
    
    for (const box of document.getElementById('nc-cards-container').children)
    {
        if (!box.classList.contains('matched'))
            return;
    }
    
    nextButton.disabled = false;
    nextButton.value = 'Confirm';
    nextButton.title = '';
    nextButton.click();
});
const ScheduleBanlistCheck = (() =>
{
    window.clearTimeout(_banlistCheckTimeout);
    _banlistCheckTimeout = window.setTimeout(DoBanlistCheck, 250);
});

const setBoxMatch = ((box, id) =>
{
    box.className = 'nc-card-box matched';
    box.searchResultsBox.className = 'nc-search-results';
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
    
    await window.CardIndexLoaded;
    
    if (token !== box.token)
        return;
    
    const name = box.adjustedText.value;

    const idxs = ((box.which === 'main') ? ['monster','spell','trap'] : (box.which === 'extra') ? ['extra'] : ['monster','spell','trap','extra']).map((k) => window.CardIndex.TypeToCards[k]);

    const exactMatch = window.CardIndex.StrictNameToCard[window.NormalizeNameStrict(name)];
    if (exactMatch && idxs.some((idx) => idx.has(exactMatch[1])))
    {
        setBoxMatch(box, exactMatch[1]);
        return;
    }

    let matches = [];
    const searchName = window.NormalizeNameLax(name);
    const searchNames = window.CardIndex.CardToNamesLax;

    const nIdxs = idxs.length;
    for (let iIdxs=0; iIdxs<nIdxs; ++iIdxs)
    {
        const idx  = idxs[iIdxs];
        const nIdx = idx.size;
        let iIdx = -1;
        for (const idxId of idx)
        {
            ++iIdx;
            if (!(iIdx % 1000))
            {
                const progress = (((iIdxs/nIdxs)+(iIdx/nIdx/nIdxs))*100).toFixed(1);
                box.loadingText.innerText = 'Searching... ('+progress+'%)';
                await sleep(0);
                if (token !== box.token)
                    return;
            }
            
            for (const [idxLocale, idxName] of (searchNames[idxId] || []))
            {
                const score = window.SearchDistanceScore(searchName, idxName, 4);
                if (score < 4)
                {
                    matches.push([idxLocale, idxId, score]);
                    break;
                }
            }
        }
    }
    box.className = 'nc-card-box';
    box.loadingText.innerText = 'Processing...';
    box.classList.add('needadj');
    matches.sort((a,b) => (a[2]-b[2]));
    let data = new Array(Math.min(matches.length,10));
    for (let i=0; i<Math.min(matches.length,10); ++i)
    {
        const [locale,id] = matches[i];
        data[i] = (GetCardData(id).then((d) => [locale,id,d.cardData[locale].name]));
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
        result.addEventListener('click', () => { setBoxMatch(box, id); });
        
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

const setSearchInterval = (function()
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
        originalText.title = name;
        box.appendChild(originalText);
        
        const adjustedText = document.createElement('input');
        adjustedText.className = 'nc-adj-text';
        adjustedText.value = name;
        adjustedText.addEventListener('keyup', (e) => { if (e.keyCode === 13) tryValidate(box) });
        adjustedText.addEventListener('input', setSearchInterval);
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
        
        tryValidate(box);
    }
});

window.NamecorrectSetup = function(backTo, assignment)
{
    backButton.backToState = backTo;
    deckName = assignment.name;
    const container = document.getElementById('nc-cards-container');
    while (container.lastElementChild)
        container.removeChild(container.lastElementChild);
    
    SetupSingle(container, 'main', assignment.main);
    SetupSingle(container, 'extra', assignment.extra);
    SetupSingle(container, 'side', assignment.side);
    
    DoBanlistCheck();
    
    document.body.className = 'state-namecorrect';
};

backButton.addEventListener('click', () =>
{
    if (document.body.className !== 'state-namecorrect')
        return;
    document.body.className = backButton.backToState;
});

nextButton.addEventListener('click', async function()
{
    if (document.body.className !== 'state-namecorrect')
        return;
    
    const decks = { main: [], extra: [], side: [] };
    for (const box of document.getElementById('nc-cards-container').children)
    {
        for (let i=0; i<box.count; ++i)
            decks[box.which].push(box.matchedCardId);
    }
    
    await EnsureScriptLoaded('state-decklist.js');
    window.SetupDeckList(backButton.backToState, { name: deckName, decks });
});

})();
