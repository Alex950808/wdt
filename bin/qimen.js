const fetch = require('node-fetch')
const md5 = require('md5');
const moment = require('moment');
const formUrlencoded = require('form-urlencoded').default;

const sleep = (time) => new Promise(reslove => setTimeout(reslove, time));

class QM {
    constructor(opt) {
        this.sid = opt.sid;
        this.appKey = opt.appKey;
        this.appSecret = opt.appSecret;
        this.target_app_key =  opt.targetAppKey
        this.retryCount = opt.retryCount || 5;
        this.timeout = opt.timeout || 10 * 1000;
        this.retryInterval = opt.retryInterval || 30 * 1000;
        this._baseUrl = opt.baseUrl || 'http://hu3cgwt0tc.api.taobao.com/router/qm';
        this._errorCodes = [15,1012, 1013, 1020, 1030, 1040, 1200, 1610]
    }

    _sign(data) {
        let keys = Object.keys(data).sort()
        let str = this.appSecret
        for (let key of keys) {
            str += `${key}${data[key]}`;
        }
        str += this.appSecret
        return md5(str).toUpperCase()
    }

    _getBody(filter) {

        let apiParams = {
            appkey: this.appKey,
            sid: this.sid,
        }
        let sysParams = {
            app_key: this.appKey,
            v: '2.0',
            format: 'json',
            sign_method: 'md5',
            timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
            target_app_key: this.target_app_key
        }
        let params = { ...apiParams, ...sysParams, ...filter};
        params.sign = this._sign(params);
        let body = formUrlencoded(params);
        return body
    }
    async _request(body) {

        let result;
        let count = 0;
        while (!result && this.retryCount >= count) {
            if (count > 0) {
                await sleep(this.retryInterval)
            }
            count++
            try {
                result =  await (await fetch(`${this._baseUrl}?${body}`, {
                    method: 'post',
                    body: body,
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                })).json()

            } catch (e) {
                console.log(e)
            }
            if (result && this._errorCodes.find(v => v == result.code)) {
                console.log('retry send request');
                result = undefined;
            }

        }
        return result.response
    }
    async eachByTime(options, cb) {
        cb = cb || async function (v) { console.log(v) }
        let { action, filter, limit, key } = options
        // let all = [];
        let { start_time, end_time } = filter;
        if (limit == undefined) {
            throw Error('wdt each action please set time limit')
        }
        if (!start_time || !end_time) {
            throw Error('wdt each action please set start_time and end_time')
        }
        await this._goByLimitTime({
            start_time,
            end_time,
        }, limit, async (filter) => {
            let list = await this.findAll(action, filter, key)
            await cb(list, filter)
        })
    }

    async _goByLimitTime(msg, limit, cb) {
        let { start_time, end_time } = msg
        start_time = new Date(start_time).getTime()
        end_time = new Date(end_time).getTime()
        while (start_time < end_time) {
            let time = start_time;
            start_time += limit
            if (start_time > end_time) {
                start_time = end_time
            }
            await cb({
                ...msg,
                start_time: moment(time).format('YYYY-MM-DD HH:mm:ss'),
                end_time: moment(start_time).format('YYYY-MM-DD HH:mm:ss'),
            })
        }
    }

    async findAll(action, filter = {}, key) {
        let list = [];
        let isEnd = false;
        let page_no = -1;
        let page_size = 100;
        if (!key) {
            throw Error('please set action master key')
        }
        while (!isEnd) {
            page_no += 1;
            let result = await this.call(action, { ...filter, page_no, page_size })
            if(key.match('.')){
                let keys = key.split('.')
                for(let key_d of keys){
                    result = result[key_d]
                }
            }else{
                result = result[key]
            }
            
            list = list.concat(result)
            if (result.length != page_size) {
                isEnd = true
            }
            await sleep(1000)
        }
        return list
    }

    async call(action, data = {}) {
        action = `wdt.${action.replace(/_/g,'.').replace('.php','')}`
        data.method = action;
        let body = this._getBody(data)
        let result = await this._request(body)
        return result
    }

}

module.exports = QM






