```
    this.sid = opt.sid;
    this.appKey = opt.appKey;
    this.appSecret = opt.appSecret;
    this.retryCount = opt.retryCount || 5; // 请求频率超过时重试次数
    this.timeout = opt.timeout || 10 * 1000; // 请求超时时间
    this.retryInterval = opt.retryInterval || 30 * 1000; // 请求重试间隔
    this._baseUrl = opt.baseUrl || 'http://api.wangdian.cn/openapi2/'; // 基础路径
```
```
const WDT = require('@bigegg/wdt-node').WDT;
let wdt = new WDT({
    sid: process.env.WDT_SID,
    appKey: process.env.WDT_APPKEY,
    appSecret: process.env.WDT_APPSECRET
})
//qm
const WDT = require('@bigegg/wdt-node').QM;
let wdt = new QM({
    appSecret: process.env.QM_APPSECERT ,
    sid: process.env.QM_SID ,
    appKey: process.env.QM_APPKEY,
    targetAppKey : process.env.QM_TARGETAPPKEY,
}) 


wdt.call('goods_query.php', {
    start_time: '2020-08-01 00:00:00',
    end_time: '2020-08-02 00:00:00'
})
wdt.call('goods_push.php', {
    goods_list: JSON.stringify([
        {
            'goods_no': 'test0001',
            'goods_type': 1,
            'goods_name': 'test',
            'spec_list': [{
                'spec_no': 'test00010001'
            }]
        }
    ])
})
wdt.findAll('goods_query.php', {
    start_time: '2020-08-01 00:00:00',
    end_time: '2020-08-15 00:00:00'
}, 'goods_list')

wdt.eachByTime({
    action: 'trade_query.php',
    filter:{
        start_time: '2020-08-01 00:00:00',
        end_time: '2020-08-03 00:00:00'
    },
    limit: 60 * 60 * 1000,
    key: 'trades'
}, async function(list){
    console.log(list)
})
```

