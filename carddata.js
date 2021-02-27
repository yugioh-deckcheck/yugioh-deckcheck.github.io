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

const nameIdxs = Promise.all(window.LOCALES.map((locale) => fetch('https://db.ygorganization.com/data/idx/card/name/'+locale).then((r) => r.json()).then((j) => [locale,j])));
window.GetCardNames = (() => nameIdxs);

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
const GetSinglePasscode = (async (id) =>
{
    const name = (await GetCardData(id)).cardData.en.name;
    await passcodeBaton.grab();
    try
    {
        const apiData = await (await fetch('https://db.ygoprodeck.com/api/v7/cardinfo.php?name='+encodeURIComponent(name))).json();
        return apiData.data[0].id;
    } finally { passcodeBaton.drop(); }
});
const passcodeCache = {};
window.GetPasscodeFor = ((id) =>
{
    let p = passcodeCache[id];
    if (p)
        return p;
    p = GetSinglePasscode(id);
    passcodeCache[id] = p;
    return p;
});

})();
