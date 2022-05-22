const fetch = require('node-fetch');

class ApiUtils {
    constructor(client, config) {
        this.client = client;
        this.config = config
    }

    async apiCall(url) {
        try {
            const res = await fetch(url)
                .then(res => res.json())
                .catch(err => { throw new Error(err) });

            return res;
        }
        catch (err) {
            console.log(err)
            return null;
        }
    }
}

module.exports = ApiUtils;