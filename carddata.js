(()=>{
    
const dropLands = ((baton) =>
{
    if (baton.waiters.length)
        baton.waiters.pop()();
    else
        baton.waiters = null;
});

class RequestThrottle
{
    constructor(timeout) { this.waiters = null; this.timeout = timeout; }
    grab()
    {
        if (this.waiters === null)
        {
            this.waiters = [];
            return Promise.resolve();
        }
        return new Promise((r) => this.waiters.push(r));
    }
    drop()
    {
        window.setTimeout(dropLands, this.timeout, this);
    }
};

window.LOCALES = ['en','de','fr','it','es','pt'];

/* for searching, requires manual input */        window.NormalizeNameLax    = ((a) => a.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ & /g,' and ').replace(/\W+/g,' ').toLowerCase());
/* for matching,  this can match automatically */ window.NormalizeNameStrict = ((a) => a.normalize('NFC').replace(/\W+/g,' ').toLowerCase());

const nameIdxO = {};
const nameList = Promise.all(window.LOCALES.map((locale) => fetch('https://db.ygorganization.com/data/idx/card/name/'+locale).then((r) => r.json()).then((j) => [locale,Object.entries(j).map(([name,[id]]) => { nameIdxO[window.NormalizeNameStrict(name)] = [locale,id]; return [id,window.NormalizeNameLax(name)]; })])));
window.GetCardNames = (() => nameList);

const nameIdxP = nameList.then(() => nameIdxO);
window.GetCardNameIndex = (() => nameIdxP);


const extraDeckIdx = (async () =>
{
    const idx = await (await fetch('https://db.ygorganization.com/data/idx/card/properties/en')).json();
    const cards = new Set();
    for (const id of idx.Fusion) cards.add(id);
    for (const id of idx.Synchro) cards.add(id);
    for (const id of idx.Xyz) cards.add(id);
    for (const id of idx.Link) cards.add(id);
    return cards;
})();
window.GetExtraDeckCards = (() => extraDeckIdx);

const carddataCache = {};
window.GetCardData = ((id) =>
{
    let p = carddataCache[id];
    if (p)
        return p;
    p = fetch('https://db.ygorganization.com/data/card/'+id).then((r) => r.json());
    carddataCache[id] = p;
    return p;
});

const artworkBaton0 = new RequestThrottle(1);
const artworkBaton1 = new RequestThrottle(1);
const artworkCache = {};
window.GetArtwork = ((cardId, artId) => (artworkCache[cardId+','+artId] || (artworkCache[cardId+','+artId] = (async ()=>
{
    const baton = ((cardId&1) ? artworkBaton1 : artworkBaton0);
    await baton.grab();
    try
    {
        const img = new Image();
        img.src = ('https://db.ygorganization.com/artwork/'+cardId+'/'+artId);
        for (let i=0; i<5; ++i)
        {
            try {
                await img.decode();
                return img;
            } catch (e) {
                console.error(cardId, artId, i, e);
                baton.drop();
                await baton.grab();
                continue;
            }
        }
        img.src = 'no_data_card.png';
        delete artworkCache[cardId+','+artId];
        await img.decode();
        return img;
    } finally { baton.drop(); }
})())));

const passcodeBaton = new RequestThrottle(100);
const GetPasscodes = (async (ids) =>
{
    const reverse = {};
    const names = await Promise.all(ids.map(async (id) =>
    {
        const name = (await GetCardData(id)).cardData.en.name;
        reverse[name] = id;
        return name;
    }));
    
    const results = {};
    for (const id of ids)
        results[id] = null;

    while (names.length)
    {
        const thisNames = names.splice(-10,10);
        await passcodeBaton.grab();
        let apiData = null;
        try
        {
            apiData = await (await fetch('https://db.ygoprodeck.com/api/v7/cardinfo.php?name='+encodeURIComponent(thisNames.join('|')))).json();
        } finally { passcodeBaton.drop(); }
        
        if (apiData.data) for (const data of apiData.data)
            results[reverse[data.name]] = data.id;
    }
    return results;
});
const passcodeCache = {};
window.GetPasscodesFor = ((ids) =>
{
    const results = {};
    ids = ids.filter((id) =>
    {
        const p = passcodeCache[id];
        if (p)
        {
            results[id] = p;
            return false;
        }
        return true;
    });
    
    if (!ids.length)
        return results;
    
    const mainPromise = GetPasscodes(ids);
    for (const id of ids)
    {
        const p = mainPromise.then((passcodes) => { const r = passcodes[id]; if (r !== null) return r; else throw ('Failed to retrieve passcode for card #'+id); });
        passcodeCache[id] = p;
        results[id] = p;
    }
    return results;
});

})();
