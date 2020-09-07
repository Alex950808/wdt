
const fetch = require('node-fetch')
const md5 = require('md5');
const moment = require('moment');
const formUrlencoded = require('form-urlencoded').default;

const sleep = (time) => new Promise(reslove => setTimeout(reslove, time));

class WdtServer {
    constructor(opt) {
        this.sid = opt.sid;
        this.appKey = opt.appKey;
        this.appSecret = opt.appSecret;
        this.retryCount = opt.retryCount || 5;
        this.timeout = opt.timeout || 10 * 1000;
        this.retryInterval = opt.retryInterval || 30 * 1000;
        this._baseUrl = opt.baseUrl || 'http://api.wangdian.cn/openapi2/';
        this._errorCodes = [1012, 1013, 1020, 1030, 1040, 1200, 1610]
    }


    static BaseInfo = {
        'goods_query.php': {
            limit: 30 * 24 * 60 * 60 * 1000,
            key: 'goods_list'
        },
        'trade_query.php': {
            limit: 60 * 60 * 1000,
            key: 'trades'
        },
        'stockout_order_query_trade.php': {
            limit: 24 * 60 * 60 * 1000,
            key: 'stockout_list'
        },
        'stockin_order_query_refund.php': {
            limit: 24 * 60 * 60 * 1000,
            key: 'stockin_list'
        },
        'stock_query.php': {
            limit: 24 * 60 * 60 * 1000,
            key: 'stocks'
        },
        'stock_transfer_query.php': {
            limit: 24 * 60 * 60 * 1000,
            key: 'transfer_list'
        },
        'warehouse_query.php': {
            limit: 0,
            key: 'warehouses'
        },
        'shop.php': {
            limit: 0,
            key: 'shoplist'
        },
        'stockin_order_query_purchase.php': {
            limit: 24 * 60 * 60 * 1000,
            key: 'stockin_list'
        },
        'purchase_order_query.php': {
            limit: 24 * 60 * 60 * 1000,
            key: 'purchase_list'
        },
        'stock_transfer_query.php': {
            limit: 24 * 60 * 60 * 1000,
            key: 'transfer_list'
        },
        "vip_stat_sales_by_spec_shop_warehouse_query.php": {
            limit: 24 * 60 * 60 * 1000,
            key: 'content'
        },
        'vip_stock_query_all.php': {
            limit: 0,
            key: 'stocks'
        }

    }


    _length(str, digit) {
        let length = str.toString().length.toString().length;
        let result = str.toString().length.toString()
        for (let i = 0; i < digit - length; i++) {
            result = '0' + result
        }
        return result
    }


    _sign(data) {
        let keys = Object.keys(data).sort()
        let str = ''
        for (let index in keys) {
            let key = keys[index];
            let q = `${this._length(key, 2)}-${key}:${this._length(data[key], 4)}-${data[key]}`
            if (index != keys.length - 1) {
                q += ';'
            }
            str += q;
        }
        str += this.appSecret
        return md5(str)
    }

    _getBody(filter) {
        filter.sid = this.sid;
        filter.appKey = this.appKey;
        filter.appkey = this.appKey;
        filter.timestamp = new Date().getTime();
        filter.sign = this._sign(filter)
        let body = formUrlencoded(filter);
        return body
    }
    async _request(action, body) {
        
        let result;
        let count = 0;
        while (!result && this.retryCount >= count) {
            if (count > 0) {
                await sleep(this.retryInterval)
            }
            count++
            try {
                
                result = await (await fetch(`${this._baseUrl}${action}?${body}`, {
                    timeout: this.timeout,
                    method: 'post',
                    body: body,
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                })).json()
            } catch (e) {
                console.log(e)
            }
            if (result && this._errorCodes.find(v => v == result.code)) {
                console.log('retry send request');
                result = undefined;
            }

        }
        return result
    }
    async eachByTime(options, cb) {
        cb = cb || async function (v) { console.log(v) }
        let { action, filter, limit, key } = options
        // let all = [];
        let { start_time, end_time } = filter;
        limit = limit || (WdtServer.BaseInfo[action] ? WdtServer.BaseInfo[action].limit : undefined);
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
            // all = all.concat(list)
        })
        // return all
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
        let baseInfo = WdtServer.BaseInfo[action]
        let list = [];
        let isEnd = false;
        let page_no = -1;
        let page_size = 100;
        key =  key || (baseInfo ? baseInfo.key : undefined);
        if(!key){
            throw Error('please set action master key')
        }
        while (!isEnd) {
            page_no += 1;
            let result = await this.call(action, { ...filter, page_no, page_size });
            if(key.match('.')){
                let  keys = key.split('.')
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

    async call(action, data = {}){
        let body = this._getBody(data)
        let result = await this._request(action, body)
        return result    
    }

}

module.exports = WdtServer