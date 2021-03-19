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
    constructor() { this.waiters = null; }
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
        window.setTimeout(dropLands, 100, this);
    }
};

window.LOCALES = ['en','de','fr','it','es','pt'];

const nameIdxs = Promise.all(window.LOCALES.map((locale) => fetch('https://db.ygorganization.com/data/idx/card/name/'+locale).then((r) => r.json()).then((j) => [locale,Object.entries(j)])));
window.GetCardNames = (() => nameIdxs);

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

const passcodeBaton = new RequestThrottle();
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
    while (names.length)
    {
        const thisNames = names.splice(-10,10);
        await passcodeBaton.grab();
        let apiData = null;
        try
        {
            apiData = await (await fetch('https://db.ygoprodeck.com/api/v7/cardinfo.php?name='+encodeURIComponent(thisNames.join('|')))).json();
        } finally { passcodeBaton.drop(); }
        
        for (const data of apiData.data)
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
        const p = mainPromise.then((passcodes) => { return passcodes[id]; });
        passcodeCache[id] = p;
        results[id] = p;
    }
    return results;
});

})();
