#!/usr/bin/env python3
"""把 what-to-eat-data 里的数据转成原型用的店铺数据。

用法（在仓库根目录）：
    python3 prototype/scripts/build_data.py data/what-to-eat-data

数据目录的原件在服务器 njuse:~/what-to-eat-data，可以先 scp 到本地已忽略的 data/ 下。
输出：
    prototype/src/api/shops.generated.ts   店铺、菜品、各平台报价
    prototype/public/img/                  菜品图、店铺图（d/、s/ 是缩略图，l/ 是点开放大用的图）
需要 Pillow（缩放图片）。同样的输入每次生成同样的结果。

数据来源：
- VitaBench（美团，MIT）：大部分店铺和菜品，只有店名、评分、菜名、价格和标签。
- 平台接口 JSON：5 家店的完整菜单和菜品图，带真实的配送费、送达时间、满减。
- 手写：1 家麻辣烫（两份数据里都没有，拍摄脚本需要）。
- 图片：photo_assignments.json 按完整菜名固定记录经审核的多来源照片，可复用。
另一个平台的价格、距离、月售、口味和忌口按规则构造；优惠券、历史订单在 mockData.ts 里手写。
"""
from __future__ import annotations

import json
import csv
import hashlib
import html
import random
import re
import shutil
import statistics
import sys
import zlib
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUT_TS = ROOT / 'src/api/shops.generated.ts'
OUT_IMG = ROOT / 'public/img'

# ---------------------------------------------------------------- 选店 ----
# 每家店一项。id 只用小写字母和数字（订单地址里用「-」分隔店铺和菜品）。
# src: vita=VitaBench 的店名（同名分店会合并），dump=平台接口文件，dishes=手写菜单。
# other: 另一个平台的上架方式；None 表示只在一个平台上架；dict 可指定 delta/missing/fee/minutes。
WORK = ['工作餐', '快餐', '简餐']
FIT = ['健康餐', '练后餐', '健身餐', '高蛋白', '减脂', '轻食']

SHOPS = [
    # 平台接口里的完整菜单（有菜品图）
    dict(id='benpao', dump='eleme__benpaoba-xiangcai', name='奔跑吧湘菜', category='川湘菜', near=True,
         tags=WORK + ['盖饭', '下饭', '湘菜'], take=14, min_price=10,
         skip_cats=['优惠', '折扣', '扫码领红包', '进店必买', '酒水饮料'], skip=r'米饭|矿泉水|雪碧|可乐'),
    dict(id='huajia', dump='eleme__huajia', name='鲍姐花甲粉', category='粉面', near=True,
         tags=WORK + ['粉丝', '米粉', '花甲'], take=12, min_price=9,
         skip_cats=['加：丸、花蛤', '加：粉，面，菜（注明加什么粉）', '饮品', '支付宝扫码送现金抵用红包', '聚宝盆'],
         other=dict(missing=2)),
    dict(id='mcd', dump='meituan__mcd-shenzhen', name='麦当劳', category='汉堡炸鸡',
         tags=['快餐', '汉堡', '炸鸡', '薯条', '早餐'], take=14, min_price=5, skip=r'开心乐园|纷享盒'),
    dict(id='pizzahut', dump='eleme__pizzahut-xinshijie', name='必胜客', category='西餐',
         tags=['披萨', '比萨', '意面', '西餐', '聚餐'], take=12, min_price=15, skip_cats=['年夜饭', '优惠'],
         other=None),
    dict(id='chabaidao', dump='eleme__chabaidao-changsha', name='茶百道', category='奶茶饮品',
         tags=['奶茶', '果茶', '饮品', '下午茶'], take=12, min_price=8, taste='甜口', skip_cats=['加料区', '茶粉小提示'],
         reviews=[
             dict(user='椰**', rating=5, daysAgo=1, dish='杨枝甘露', text='杨枝甘露芒果给得很足，少冰刚好，回购第三次了。'),
             dict(user='匿名用户', rating=4, daysAgo=2, dish='茉莉白桃子', text='白桃味道清爽，就是半糖还是有点甜，下次三分糖。'),
             dict(user='小**', rating=5, daysAgo=4, dish='豆乳玉麒麟', text='豆乳玉麒麟奶味很浓，麻薯软糯，冬天点热的很舒服。'),
             dict(user='a**9', rating=3, daysAgo=6, text='送到的时候冰化了一些，味道还行。'),
             dict(user='匿名用户', rating=5, daysAgo=9, dish='手剥葡萄冻', text='葡萄是真的手剥的，颗颗都有，推荐。'),
         ]),
    # VitaBench
    dict(id='huangmen', vita=['黄焖鸡米饭'], name='杨记黄焖鸡米饭', category='盖饭快餐', near=True, tags=WORK + ['盖饭']),
    dict(id='biandang', vita=['便当工坊'], name='便当工坊', category='盖饭快餐', near=True, tags=WORK + ['便当']),
    dict(id='fantuan', vita=['饭团家族'], name='饭团家族', category='盖饭快餐', near=True, tags=WORK + ['饭团', '早餐']),
    dict(id='jitang', vita=['老鸡汤饭馆'], name='老鸡汤饭馆', category='盖饭快餐', tags=WORK + ['鸡汤饭']),
    dict(id='chuanwei', vita=['川味小馆'], name='川味小馆', category='川湘菜', near=True, tags=WORK + ['川菜', '盖饭', '下饭']),
    dict(id='xiaosichuan', vita=['小四川（师范街店）'], name='小四川', category='川湘菜', tags=['川菜', '家常菜', '下饭']),
    dict(id='chengzhong', vita=['城中香·土菜馆（金华店）'], name='城中香·土菜馆', category='家常菜', tags=['土菜', '家常菜', '下饭']),
    dict(id='xiaochaimi', vita=['小柴米餐厅（万科广场店）'], name='小柴米餐厅', category='家常菜', tags=['江西菜', '家常菜', '下饭']),
    dict(id='yaowang', vita=['瑶王府-广西菜（教育路店）'], name='瑶王府·广西菜', category='家常菜', tags=['广西菜', '家常菜']),
    dict(id='fuyuan', vita=['福圆家常菜馆·大连海鲜'], name='福圆家常菜馆', category='东北菜', tags=['东北菜', '家常菜'], max_price=60),
    dict(id='jinzhangshao', vita=['金掌勺锅包肉（公园时代城店）'], name='金掌勺锅包肉', category='东北菜',
         tags=['东北菜', '锅包肉', '聚餐'], max_price=80),
    dict(id='junsi', vita=['君思粤小厨'], name='君思粤小厨', category='粤菜', tags=['粤菜', '煲仔饭', '粥']),
    dict(id='jintang', vita=['金汤铺炖汤世家（江南西店）'], name='金汤铺炖汤世家', category='汤粥', taste='清淡',
         tags=['炖汤', '养生', '健康餐', '清淡']),
    dict(id='shiyang', vita=['食养先生'], name='食养先生', category='轻食', taste='健康', tags=FIT + ['营养餐', '低碳水']),
    dict(id='chaoneng', vita=['超能鹿战队·轻食减脂餐(椒江店)'], name='超能鹿战队·轻食减脂餐', category='轻食', taste='健康',
         tags=FIT + ['沙拉', '牛排'], new_shop=True),
    dict(id='qingshi', vita=['轻食优选'], name='轻食优选', category='轻食', taste='健康', tags=FIT + ['沙拉', '便当']),
    dict(id='shucai', vita=['鲜蔬沙拉(解放碑店)'], name='鲜蔬沙拉', category='轻食', taste='健康', tags=FIT + ['沙拉', '低卡']),
    dict(id='huhutai', vita=['HUHU泰（罗斯福店）'], name='HUHU泰', category='东南亚菜', tags=['泰餐', '冬阴功', '东南亚'],
         new_shop=True),
    dict(id='kfc', vita=['肯德基(无锡海岸城餐厅)'], name='肯德基', category='汉堡炸鸡', tags=['快餐', '炸鸡', '汉堡'],
         max_price=40),
    dict(id='wallace', vita=['华莱士(无锡滨湖店)'], name='华莱士', category='汉堡炸鸡', near=True,
         tags=['快餐', '炸鸡', '汉堡', '工作餐']),
    dict(id='shengjian', vita=['鲜味生煎'], name='鲜味生煎', category='小吃点心', near=True, tags=['生煎', '早餐', '小吃']),
    dict(id='yexiao', vita=['夜宵烧烤王'], name='夜宵烧烤王', category='烧烤', taste='重口', tags=['烧烤', '烤串', '夜宵', '聚餐'],
         max_price=90, reviews=[
             dict(user='周**', rating=5, daysAgo=2, dish='电竞夜宵套餐', text='套餐分量很足，三个人吃刚好，羊肉串没有膻味。'),
             dict(user='匿名用户', rating=4, daysAgo=3, dish='烤羊肉串(10串)', text='串很入味，送到还是热的，就是有点咸。'),
             dict(user='l**k', rating=5, daysAgo=5, text='周五宿舍聚餐点的，烤生蚝蒜蓉超香。'),
             dict(user='匿名用户', rating=3, daysAgo=8, text='等了快一个小时，味道不错但太慢了。'),
         ]),
    dict(id='laoma', vita=['老马烧烤'], name='老马烧烤', category='烧烤', taste='重口', tags=['烧烤', '烤串', '夜宵'],
         max_price=90),
    dict(id='bawang', vita=['霸王茶姬（万象天地店）'], name='霸王茶姬', category='奶茶饮品', taste='清淡',
         tags=['奶茶', '茶饮', '饮品', '下午茶']),
    dict(id='mixue', vita=['蜜雪冰城', '蜜雪冰城(远大购物广场店)'], name='蜜雪冰城', category='奶茶饮品', near=True, taste='甜口',
         tags=['奶茶', '柠檬水', '饮品', '冰淇淋']),
    dict(id='xianyu', vita=['鲜芋仙(明发广场店)'], name='鲜芋仙', category='甜品蛋糕', taste='甜口',
         tags=['甜品', '芋圆', '下午茶']),
    dict(id='c85', vita=['85度C(瑶海万达店)', '85度C(太原长风街店)', '85度C'], name='85度C', category='甜品蛋糕', taste='甜口',
         tags=['蛋糕', '小蛋糕', '甜品', '面包', '下午茶'], max_price=50),
    # 手写：两份数据里都没有麻辣烫店
    dict(id='malatang', name='老街麻辣烫', category='麻辣烫', rating=4.6, tags=['麻辣烫', '冒菜', '麻辣拌'],
         dishes=[
             ('招牌麻辣烫（自选）', 22), ('番茄麻辣烫', 23), ('骨汤麻辣烫（不辣）', 21), ('干拌麻辣拌', 24),
             ('牛肉丸麻辣烫', 26), ('全家福麻辣烫', 32), ('酸辣粉', 14), ('冰粉', 6),
         ]),
]

CATEGORY_STYLE = {
    '盖饭快餐': ('🍱', 30), '川湘菜': ('🌶️', 8), '家常菜': ('🥘', 25), '东北菜': ('🍖', 20), '粤菜': ('🍲', 18),
    '汤粥': ('🥣', 40), '轻食': ('🥗', 110), '东南亚菜': ('🍛', 50), '汉堡炸鸡': ('🍔', 35), '西餐': ('🍕', 15),
    '粉面': ('🍜', 45), '小吃点心': ('🥟', 210), '麻辣烫': ('🍢', 5), '烧烤': ('🍢', 12), '奶茶饮品': ('🧋', 28),
    '甜品蛋糕': ('🍰', 330),
}

# ---------------------------------------------------------- 口味与忌口 ----
NOT_SPICY = re.compile(r'不辣|(?<!不)免辣')
TASTE_RULES = [  # 顺序即优先级，每道菜最多两个口味
    ('酸辣', re.compile(r'酸辣|酸菜|泡椒|酸汤|冬阴功|螺蛳|柠檬.*鸡爪|擂椒|番茄.*粉')),
    ('香辣', re.compile(r'辣|麻婆|剁椒|椒麻|水煮|沸腾|干锅|毛血旺|冒菜|藤椒|火鸡|夫妻肺片|口水|鸭脖|辣子')),
    ('健康', re.compile(r'沙拉|轻食|藜麦|鸡胸|低脂|低卡|低碳|减脂|增肌|蛋白|全麦|燕麦|牛油果|果蔬|有机|素食|能量')),
    ('清淡', re.compile(r'清汤|清蒸|白切|白灼|蒸|粥|炖|靓汤|鸡汤|骨汤|原味|时蔬|饭团|双皮奶|西米露|椰子鸡|菌菇|豆浆|茉莉|绿茶|青茶|栀子')),
    ('重口', re.compile(r'红烧|卤|酱|干锅|烤|炸|肥肠|猪脚|锅包肉|乱炖|回锅|小炒|爆炒|麻辣|黄焖|扣肉|腊|串|生煎|鸡排|汉堡|堡|血鸭')),
    ('甜口', re.compile(r'甜|蜜汁|糖醋|奶茶|蛋糕|慕斯|布丁|芋圆|芋泥|麻薯|冰淇淋|甜筒|班戟|杨枝甘露|叉烧|照烧|菠萝|芒|奶盖|拿铁|'
                       r'果茶|葡萄|桃|椰|曲奇|奶绿|提拉米苏|冰粉|百香果|西瓜|柠檬')),
]
TASTE_TAGS = {'健康': {'健康', '低脂', '高蛋白', '低卡', '轻食', '素食', '低碳水', '营养餐'},
              '清淡': {'清淡', '易消化', '温和', '清爽'}, '香辣': {'麻辣', '香辣', '川菜', '微辣'}, '甜口': {'甜点'}}
CONFLICT = {'清淡': {'香辣', '酸辣', '重口'}, '香辣': {'清淡'}, '酸辣': {'清淡', '香辣'}, '重口': {'清淡', '健康'},
            '健康': {'重口'}, '甜口': set()}
AVOID_RULES = [
    ('香菜', re.compile(r'香菜|凉皮|酸辣粉|口水|凉拌|夫妻肺片|螺蛳|冬阴功|麻辣拌')),
    ('葱蒜', re.compile(r'葱|蒜|回锅|油泼|腊汁')),
    ('辣椒', re.compile(r'辣|剁椒|尖椒|擂椒|泡椒|水煮|沸腾|毛血旺|冒菜|火鸡|麻婆|小炒肉|小炒黄牛肉|干锅')),
    ('海鲜', re.compile(r'虾|蟹|贝|蛤|蚝|鱿|海鲜|三文鱼|金枪鱼|带鱼|花甲|鲍|墨鱼|章鱼|八爪|鱼籽|海底椰')),
    ('牛羊肉', re.compile(r'(?<!蜗)牛(?!奶|油果|乳|蛙)|羊(?!奶)')),
]
DISH_EMOJI = [  # 按顺序匹配，具体的食物在前，饮料放后面
    (r'茶树菇|菌菇|蘑菇', '🍄'), (r'油茶|鸡汤|靓汤|炖汤', '🍲'), (r'汉堡|堡', '🍔'), (r'薯条|薯格|薯饼', '🍟'), (r'油条', '🥖'),
    (r'披萨|比萨', '🍕'), (r'意面|意大利面|千层面', '🍝'), (r'寿司|饭团', '🍙'), (r'沙拉|轻食|能量碗|藜麦', '🥗'),
    (r'三明治|卷', '🌯'), (r'鸡翅|鸡腿|炸鸡|鸡块|麦乐鸡|鸡排|鸡米花|鸡柳|鸡翼', '🍗'), (r'咖啡|美式|摩卡', '☕'),
    (r'蛋糕|慕斯|提拉米苏|班戟|曲奇|面包|巧克力杯|糕', '🍰'), (r'冰淇淋|甜筒|雪花冰|冰粉', '🍨'),
    (r'布丁|双皮奶|西米露|芋圆鲜奶|红豆', '🍮'), (r'炒饭|糯米饭|盖饭|烧肉饭', '🍚'), (r'啤|酒(?!冻)', '🍺'),
    (r'奶茶|奶绿|乌龙|拿铁|奶盖|麻薯|啵啵|生打椰|玉麒麟|拉茶|茶|栀', '🧋'),
    (r'果汁|柠檬|橙|西柚|葡萄|桃|芒|西瓜|杨枝甘露|百香果|可乐|雪碧|汽水|饮料|酒冻', '🥤'), (r'粥', '🥣'),
    (r'生煎|汤包|包子', '🥟'), (r'饺', '🥟'), (r'串|烤', '🍢'), (r'鱼', '🐟'), (r'虾|蟹|花甲|蛤|蚝|海鲜|鱿', '🦐'),
    (r'面|粉|米线', '🍜'), (r'汤|煲|炖|锅|麻辣烫', '🍲'), (r'饭|盖浇', '🍚'), (r'鸡|鸭', '🍗'),
    (r'牛|羊|猪|肉|排骨|肺片', '🍖'), (r'蛋', '🍳'), (r'豆腐|菜|时蔬|茄子|空心菜|西兰花|豆角|花菜|玉米', '🥬'),
]
DISH_EMOJI = [(re.compile(p), e) for p, e in DISH_EMOJI]

VITA_BAD = re.compile(r'票|代订|密室|门票|酒店|充电|雨伞|毛巾|口罩|纸巾|洗|袜|T恤|耳机|花束|玩具|奶粉|尿|贺卡|礼盒|派对|'
                      r'装饰|\d+人|人份|酒精系列|健身餐-|营养蛋白质粥|能量果蔬汁')
STAPLE = re.compile(r'^(五常|香喷喷的|高级香)?大?米饭$')
SHOP_TAG_SKIP = re.compile(r'营业|外卖|配送|堂食|必点榜|上榜|油腻|^\d')
# 只有这些类别的店，才用数据自带的「高蛋白」「低脂」等标签判断「健康」，免得烤串也被算成健康餐
HEALTHY_CATS = {'轻食', '汤粥'}


def tastes_of(name: str, tags=(), fallback: str | None = None, healthy_cat: bool = False) -> list[str]:
    found: list[str] = []
    for taste, rule in TASTE_RULES:
        by_tag = bool(TASTE_TAGS.get(taste, set()) & set(tags)) and (taste != '健康' or healthy_cat)
        hit = bool(rule.search(name)) or by_tag
        if taste in ('香辣', '酸辣') and NOT_SPICY.search(name):
            hit = False
        if hit and not (CONFLICT[taste] & set(found)) and len(found) < 2:
            found.append(taste)
    if not found and fallback:
        found.append(fallback)
    return found


def avoids_of(name: str, tastes: list[str]) -> list[str]:
    out = []
    for avoid, rule in AVOID_RULES:
        hit = bool(rule.search(name))
        if avoid == '辣椒':
            hit = (hit or '香辣' in tastes or '酸辣' in tastes) and not NOT_SPICY.search(name)
        if hit:
            out.append(avoid)
    return out


def emoji_of(name: str, fallback: str) -> str:
    return next((e for rule, e in DISH_EMOJI if rule.search(name)), fallback)


def r1(x: float) -> float:
    v = round(x + 1e-9, 1)
    return int(v) if v == int(v) else v


# ------------------------------------------------------------ 读取数据 ----
def load_vita(data: Path) -> dict[str, dict]:
    stores: dict[str, dict] = {}
    for fn in ('delivery_tasks.json', 'cross_domain_tasks.json'):
        for task in json.loads((data / 'vitabench' / fn).read_text(encoding='utf-8')):
            for s in task['environment'].get('stores', {}).values():
                e = stores.setdefault(s['name'], {'scores': [], 'tags': [], 'products': {}})
                e['scores'].append(s['score'])
                e['tags'] += [t for t in s['tags'] if t not in e['tags']]
                for p in s['products']:
                    e['products'].setdefault(p['name'].strip(), p)
    return stores


def norm(name: str) -> str:
    return name.translate(str.maketrans('（）【】', '()[]')).replace(' ', '')


def from_vita(cfg: dict, stores: dict) -> dict:
    scores, tags, items = [], [], {}
    for src in cfg['vita']:
        e = stores[src]
        scores += e['scores']
        tags += [t for t in e['tags'] if t not in tags]
        for p in e['products'].values():
            items.setdefault(norm(p['name']), p)
    max_price = cfg.get('max_price', 70)
    dishes = []
    for p in items.values():
        name = p['name'].strip()
        if VITA_BAD.search(name) or STAPLE.match(name) or not 3 <= p['price'] <= max_price:
            continue
        dishes.append(dict(name=name, price=r1(p['price']), tags=[t for t in p['tags'] if len(t) <= 4]))
    return dict(rating=round(statistics.mean(scores), 1), tags=[t for t in tags if not SHOP_TAG_SKIP.search(t)],
                dishes=dishes, platform='meituan')


DISCOUNT = re.compile(r'满(\d+)元?减(\d+)')


def from_dump(cfg: dict, data: Path) -> dict:
    menus = data / 'platform-dumps/menus'
    stem = cfg['dump']
    skip = re.compile(cfg['skip']) if cfg.get('skip') else None
    skip_cats = set(cfg.get('skip_cats', []))
    foods: dict[str, dict] = {}
    if stem.startswith('meituan'):
        menu = json.loads((menus / f'{stem}__menu.json').read_text(encoding='utf-8'))['data']
        shop = json.loads((menus / f'{stem}__shop.json').read_text(encoding='utf-8'))['data']
        for tag in menu['food_spu_tags']:
            if tag['name'] in skip_cats:
                continue
            for s in tag['spus']:
                foods.setdefault(s['name'], dict(name=s['name'], price=s['min_price'], sales=s.get('month_saled') or 0,
                                                 key=str(s['id']), new=False, pack=0))
        meta = dict(platform='meituan', rating=shop['wm_poi_score'], fee=shop['shipping_fee'],
                    minutes=shop['avg_delivery_time'], discounts=[], distance=None, pack=0,
                    sales=sum(f['sales'] for f in foods.values()), image_stem=f'{stem}__shop')
        menu_stem = f'{stem}__menu'
    else:
        j = json.loads((menus / f'{stem}.json').read_text(encoding='utf-8'))
        rst, menu = (j.get('rst') or j.get('shopDetails')), (j.get('menu') or j.get('shopMenu'))
        for cat in menu:
            if cat['name'] in skip_cats:
                continue
            for f in cat.get('foods', []):
                specs = f.get('specfoods') or []
                if not specs:
                    continue
                foods.setdefault(f['name'], dict(
                    name=f['name'], price=min(s['price'] for s in specs), sales=f.get('month_sales') or 0,
                    key=str(f.get('item_id') or f.get('food_id')), new=cat['name'] == '新品推荐',
                    pack=statistics.median(s.get('packing_fee') or 0 for s in specs)))
        discounts = []
        for a in rst.get('activities', []):
            if a.get('type') == 102 or ('满' in (a.get('description') or '') and '减' in (a.get('description') or '')
                                         and '新用户' not in a.get('description', '')):
                discounts = [dict(threshold=int(t), off=int(o)) for t, o in DISCOUNT.findall(a['description'])]
                if discounts:
                    break
        meta = dict(platform='eleme', rating=rst['rating'], fee=rst['float_delivery_fee'],
                    minutes=rst.get('order_lead_time') or None, discounts=discounts, distance=rst.get('distance'),
                    sales=rst.get('recent_order_num') or 0, image_stem=f'{stem}__shop')
        menu_stem = stem
    picked = [f for f in foods.values() if f['price'] >= cfg.get('min_price', 0) and not (skip and skip.search(f['name']))]
    picked.sort(key=lambda f: -f['sales'])
    picked = picked[: cfg['take']]
    for f in picked:
        files = sorted((data / 'images/dishes').glob(f'{menu_stem}_{f["key"]}.*'))
        f['image_src'] = files[0] if files else None
    if 'pack' not in meta:
        meta['pack'] = r1(statistics.median(f['pack'] for f in picked))
    shop_imgs = sorted((data / 'images/shops').glob(f'{meta.pop("image_stem")}*'))
    meta['image_src'] = shop_imgs[0] if shop_imgs else None
    return dict(meta=meta, dishes=[dict(name=f['name'], price=r1(f['price']), sales=f['sales'], new=f['new'],
                                       image_src=f['image_src']) for f in picked])


# ------------------------------------------------------------ 构造字段 ----
def gen_discounts(level: float, rng: random.Random, drink: bool) -> list[dict]:
    lo, hi = (0.05, 0.12) if drink else (0.12, 0.28)
    t1 = max(15, round(level * rng.uniform(0.9, 1.3)))
    ratio = rng.uniform(lo, hi)
    tiers = [(t1, max(1, round(t1 * ratio)))]
    for _ in range(rng.choice([1, 1, 2])):
        t = round(tiers[-1][0] * rng.uniform(1.5, 1.9))
        o = max(tiers[-1][1] + 1, round(t * (ratio + rng.uniform(0.01, 0.04))))
        tiers.append((t, o))
    return [dict(threshold=t, off=o) for t, o in tiers]


def shop_rng(sid: str, salt: str = '') -> random.Random:
    return random.Random(zlib.crc32(f'{sid}{salt}'.encode()))


class Photos:
    """逐菜审核的固定配图。跨店可复用，同店不同菜必须有区别。"""

    def __init__(self, data: Path):
        self.root = data
        catalog = json.loads((Path(__file__).with_name('photo_assignments.json')).read_text(encoding='utf-8'))
        self.assets = catalog['assets']
        self.dishes = catalog['dishes']
        self.shops = catalog['shops']
        self.meta = {e['file']: e for e in self.assets.values()}
        self.credits: dict[str, dict] = {}
        for entry in self.assets.values():
            path = data / entry['file']
            if not path.is_file():
                raise ValueError(f'缺少图片 {entry["file"]}；先运行 fetch_photos.py 下载已审核图片')
            if hashlib.sha256(path.read_bytes()).hexdigest() != entry['sha256']:
                raise ValueError(f'图片内容与审核版本不一致：{entry["file"]}')

    def pick(self, shop_id: str, name: str) -> Path:
        asset = self.dishes.get(shop_id, {}).get(name)
        if asset is None:
            raise ValueError(f'尚未审核配图：{shop_id} / {name}；请补充 photo_assignments.json')
        return self.root / self.assets[asset]['file']

    def validate_menu(self, stores: dict) -> None:
        """在删除旧输出前核对所有菜单映射，新增菜不能悄悄套用大类图。"""
        expected_shops = {cfg['id'] for cfg in SHOPS}
        if set(self.dishes) != expected_shops or set(self.shops) != expected_shops:
            raise ValueError('图片清单与店铺列表不一致，请更新 photo_assignments.json')
        for cfg in SHOPS:
            if 'dump' in cfg:
                names = {d['name'] for d in from_dump(cfg, self.root)['dishes']}
            elif 'vita' in cfg:
                names = {d['name'] for d in from_vita(cfg, stores)['dishes']}
            else:
                names = {name for name, _ in cfg['dishes']}
            mapped = set(self.dishes[cfg['id']])
            if names != mapped:
                raise ValueError(f'{cfg["id"]} 配图缺少 {names - mapped}，多余 {mapped - names}')
            seen: dict[str, str] = {}
            for name in names:
                self.pick(cfg['id'], name)
                entry = self.assets[self.dishes[cfg['id']][name]]
                digest = entry['sha256']
                if digest in seen:
                    raise ValueError(f'{cfg["id"]} 店内配图重复：{seen[digest]} / {name}；请按菜式或套餐内容分别配图')
                seen[digest] = name
            self.shop(cfg['id'])

    def shop(self, shop_id: str) -> Path:
        return self.root / self.assets[self.shops[shop_id]]['file']

    def credit(self, out: str, src: Path) -> None:
        rel = src.relative_to(self.root).as_posix() if src.is_relative_to(self.root) else None
        if rel in self.meta:
            self.credits[out] = self.meta[rel]


def build_shop(cfg: dict, stores: dict, data: Path, photos: Photos) -> dict:
    sid = cfg['id']
    rng = shop_rng(sid)
    emoji, hue = CATEGORY_STYLE[cfg['category']]
    drink = cfg['category'] in ('奶茶饮品', '甜品蛋糕')

    if 'dump' in cfg:
        src = from_dump(cfg, data)
        meta, raw = src['meta'], src['dishes']
        rating, extra_tags = meta['rating'], []
    elif 'vita' in cfg:
        src = from_vita(cfg, stores)
        raw = [dict(name=d['name'], price=d['price'], tags=d['tags']) for d in src['dishes']]
        rating, extra_tags = src['rating'], src['tags']
        meta = dict(platform='meituan', image_src=None)
    else:
        raw = [dict(name=n, price=p) for n, p in cfg['dishes']]
        rating, extra_tags = cfg['rating'], []
        meta = dict(platform='meituan', image_src=None)
    if len(raw) < 4:
        print(f'警告：{cfg["name"]} 只有 {len(raw)} 道菜', file=sys.stderr)

    # 距离、月售、送达时间
    distance = meta.get('distance')
    distance = r1(distance / 1000) if distance else r1(rng.uniform(0.3, 0.9) if cfg.get('near') else rng.uniform(0.9, 3.2))
    if meta.get('sales'):
        shop_sales = int(meta['sales'])
    else:
        shop_sales = int(rng.uniform(300, 1200) if cfg.get('new_shop') else rng.uniform(800, 5200) * (rating - 3.6))
    minutes = meta.get('minutes') or max(16, round(15 + distance * 6 + rng.randint(-2, 5)))
    level = statistics.median(d['price'] for d in raw)

    # 菜品月售：没有真实数据时按「招牌」优先随机分配
    if not all('sales' in d for d in raw):
        weights = [rng.uniform(0.3, 1.0) * (2.2 if re.search(r'招牌|爆款|热销|必点|人气|经典', d['name']) else 1) for d in raw]
        total = sum(weights)
        for d, w in zip(raw, weights):
            d['sales'] = max(12, int(shop_sales * 0.55 * w / total))
    raw.sort(key=lambda d: -d['sales'])
    if not any(d.get('new') for d in raw) and rng.random() < 0.45 and len(raw) >= 5:
        raw[-1]['new'] = True

    dishes = []
    for i, d in enumerate(raw):
        did = f'{sid}-{i + 1}'
        t = tastes_of(d['name'], d.get('tags', []), cfg.get('taste'), cfg['category'] in HEALTHY_CATS)
        dish = dict(id=did, shopId=sid, name=d['name'], price=d['price'], tastes=t, contains=avoids_of(d['name'], t),
                    emoji=emoji_of(d['name'], emoji), monthlySales=int(d['sales']), isNew=bool(d.get('new')))
        if d.get('tags'):
            dish['tags'] = d['tags']
        src_img = photos.pick(sid, d['name'])
        if src_img:
            dish['image'] = save_image(src_img, f'd/{did}.webp', 240)
            dish['imageLarge'] = save_large(src_img, f'l/d/{did}.webp')
            photos.credit(dish['image'], src_img)
        dishes.append(dish)

    # 来源平台的上架信息
    base = dict(platform=meta['platform'],
                deliveryMin=int(minutes),
                deliveryFee=r1(meta['fee']) if 'fee' in meta else rng.choice([0, 1, 1, 1.5, 2, 2, 2.5, 3, 3.5, 4]),
                packFee=r1(meta['pack']) if 'pack' in meta else (rng.choice([0.5, 1]) if drink else rng.choice([1, 1, 1.5, 2])),
                discounts=meta.get('discounts') or gen_discounts(level, rng, drink),
                prices={d['id']: d['price'] for d in dishes})
    listings = [base]

    # 另一个平台：菜价整体略有高低、个别菜不卖、配送费和满减不同
    other = cfg.get('other', {})
    if other is not None:
        orng = shop_rng(sid, 'other')
        delta = other.get('delta', orng.choice([-0.5, 0, 0, 0.5, 1]) if level < 15
                          else orng.choice([-1, 0, 0, 1, 1, 2]))
        n_missing = other.get('missing', orng.choice([0, 0, 0, 1, 1, 2]))
        tail = [d['id'] for d in dishes[2:]]
        missing = set(orng.sample(tail, min(n_missing, len(tail) // 2)))
        prices = {}
        for d in dishes:
            if d['id'] in missing:
                continue
            jitter = orng.choice([-1, 1]) if orng.random() < 0.15 else 0
            prices[d['id']] = r1(max(1, d['price'] + delta + jitter))
        fee = other.get('fee', max(0, min(6, base['deliveryFee'] + orng.choice([-2, -1, -0.5, 0, 0.5, 1, 2]))))
        listings.append(dict(
            platform='eleme' if base['platform'] == 'meituan' else 'meituan',
            deliveryMin=int(other.get('minutes', max(15, base['deliveryMin'] + orng.randint(-4, 6)))),
            deliveryFee=r1(fee),
            packFee=r1(max(0, base['packFee'] + orng.choice([-0.5, 0, 0, 0.5]))),
            discounts=gen_discounts(level, orng, drink),
            prices=prices,
        ))
    orng = shop_rng(sid, 'order')
    if orng.random() < 0.5:
        listings.reverse()  # 上架顺序不固定，界面不要依赖哪个平台在前

    for d in dishes:
        d['price'] = min(l['prices'][d['id']] for l in listings if d['id'] in l['prices'])

    tags = list(dict.fromkeys(cfg.get('tags', []) + [t for t in extra_tags if t != cfg['category']]))
    shop = dict(id=sid, name=cfg['name'], category=cfg['category'], tags=tags, rating=rating, monthlySales=shop_sales,
                distanceKm=distance, emoji=emoji, hue=hue)
    if cfg.get('new_shop'):
        shop['isNewShop'] = True
    # 店铺封面固定为审核过的店铺图或代表菜，不再随销量排序变化。
    shop_src = photos.shop(sid)
    if shop_src:
        shop['image'] = save_image(shop_src, f's/{sid}.webp', 192)
        shop['imageLarge'] = save_large(shop_src, f'l/s/{sid}.webp')
        photos.credit(shop['image'], shop_src)
    if cfg.get('reviews'):
        names = {d['name'] for d in dishes}
        for r in cfg['reviews']:
            assert 'dish' not in r or r['dish'] in names, f'{cfg["name"]} 的评价提到了菜单里没有的「{r["dish"]}」'
        shop['reviews'] = cfg['reviews']
    shop['dishes'] = dishes
    shop['listings'] = listings
    return shop


def save_image(src: Path, rel: str, size: int) -> str:
    out = OUT_IMG / rel
    out.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(src) as im:
        # 保留整盘菜和套餐各单品，避免居中裁切把主料截掉。
        im = ImageOps.pad(rgb_image(im), (size, size), Image.Resampling.LANCZOS, color='white')
        im.save(out, 'WEBP', quality=82, method=6)
    return versioned_image_url(out, rel)


def rgb_image(im: Image.Image) -> Image.Image:
    im = ImageOps.exif_transpose(im).convert('RGBA')
    background = Image.new('RGBA', im.size, 'white')
    background.alpha_composite(im)
    return background.convert('RGB')


def save_large(src: Path, rel: str, side: int = 1200) -> str:
    """点开放大时用的图：保持原比例，长边不超过 side。"""
    out = OUT_IMG / rel
    out.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(src) as im:
        im = rgb_image(im)
        im.thumbnail((side, side), Image.Resampling.LANCZOS)
        im.save(out, 'WEBP', quality=85, method=6)
    return versioned_image_url(out, rel)


def versioned_image_url(path: Path, rel: str) -> str:
    """图片内容改变时更新 URL，避免浏览器继续使用同一路径的旧图。"""
    version = hashlib.sha256(path.read_bytes()).hexdigest()[:12]
    return f'img/{rel}?v={version}'


def write_photo_review(shops: list[dict], photos: Photos) -> None:
    """独立的图片核对页：菜名、实际配图与来源并排，便于继续检查。"""
    esc = html.escape
    cards = []
    for shop in shops:
        for dish in shop['dishes']:
            entry = photos.assets[photos.dishes[shop['id']][dish['name']]]
            links = entry.get('pages') or [entry['page']]
            source_links = ' · '.join(f'<a href="{esc(url, quote=True)}" target="_blank" rel="noopener noreferrer">来源 {i + 1}</a>'
                                      for i, url in enumerate(links))
            key = esc(f'{shop["name"]} {dish["name"]}', quote=True)
            cards.append(f'''<article data-search="{key}">
              <a href="{esc(dish['imageLarge'][4:])}" target="_blank"><img loading="lazy" src="{esc(dish['image'][4:])}" alt="{esc(dish['name'])}"></a>
              <h2>{esc(dish['name'])}</h2><p>{esc(shop['name'])}</p>
              <p>{esc(entry['note'])}</p><p>{source_links}</p></article>''')
    page = '''<!doctype html><html lang="zh-CN"><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1"><title>菜品配图核对</title>
    <style>body{font:16px/1.5 system-ui,sans-serif;margin:24px;color:#222;background:#f5f5f4}
    h1{font-size:24px}input{font:inherit;padding:12px;width:min(600px,90%);margin-bottom:24px}
    main{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:20px}
    article{background:white;padding:16px;border-radius:12px}article[hidden]{display:none}
    img{width:100%;height:220px;object-fit:contain}h2{font-size:17px}p{font-size:14px;color:#555}a{color:#176b50}</style>
    <h1>菜品配图核对 · DISH_COUNT 道菜</h1><p>点击图片查看大图；可按店名、菜名查找。来源与配图范围逐项记录在卡片中。</p>
    <input id="search" type="search" placeholder="搜索店名或菜名" aria-label="搜索店名或菜名"><main>'''
    page = page.replace('DISH_COUNT', str(len(cards)))
    page += '\n'.join(cards) + '''</main><script>
    document.getElementById('search').addEventListener('input', e => {
      const q = e.target.value.trim().toLowerCase();
      document.querySelectorAll('article').forEach(el => el.hidden = !el.dataset.search.toLowerCase().includes(q));
    });</script></html>'''
    (OUT_IMG / 'review.html').write_text(page, encoding='utf-8')


# ---------------------------------------------------------------- 输出 ----
def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    data = Path(sys.argv[1])
    stores = load_vita(data)
    photos = Photos(data)
    photos.validate_menu(stores)
    if OUT_IMG.exists():
        shutil.rmtree(OUT_IMG)
    shops = [build_shop(cfg, stores, data, photos) for cfg in SHOPS]
    ids = [s['id'] for s in shops]
    assert len(ids) == len(set(ids)) and all(re.fullmatch(r'[a-z0-9]+', i) for i in ids), ids

    lines = ['// 由 prototype/scripts/build_data.py 生成，不要手改；改选店或规则后重新运行脚本。',
             "import type { Shop } from '../types';", '', 'export const GENERATED_SHOPS: Shop[] = [']
    for s in shops:
        head = {k: v for k, v in s.items() if k not in ('dishes', 'listings', 'reviews')}
        lines.append('  {')
        for k, v in head.items():
            lines.append(f'    {k}: {json.dumps(v, ensure_ascii=False)},')
        if 'reviews' in s:
            lines.append('    reviews: [')
            lines += [f'      {json.dumps(r, ensure_ascii=False)},' for r in s['reviews']]
            lines.append('    ],')
        lines.append('    dishes: [')
        lines += [f'      {json.dumps(d, ensure_ascii=False)},' for d in s['dishes']]
        lines.append('    ],')
        lines.append('    listings: [')
        lines += [f'      {json.dumps(l, ensure_ascii=False)},' for l in s['listings']]
        lines.append('    ],')
        lines.append('  },')
    lines.append('];')
    OUT_TS.write_text('\n'.join(lines) + '\n', encoding='utf-8')

    # 所有图片的来源与配图说明（包括平台原图和拼排套餐图）。
    tag = re.compile(r'<[^>]+>')
    with (OUT_IMG / 'CREDITS.tsv').open('w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f, delimiter='\t', lineterminator='\n')
        writer.writerow(['图片', '来源', '许可', '作者', '来源标题', '配图说明', '原图'])
        for out, e in sorted(photos.credits.items()):
            artist = ' '.join(tag.sub('', e.get('artist', '')).split())
            pages = ' | '.join(e.get('pages') or [e['page']])
            urls = e.get('url') or ' | '.join(photos.assets[k]['url'] for k in e.get('components', []))
            writer.writerow([out, pages, e.get('license', ''), artist, e['title'], e['note'], urls])
    write_photo_review(shops, photos)

    n_dish = sum(len(s['dishes']) for s in shops)
    n_img = sum(1 for s in shops for d in s['dishes'] if 'image' in d)
    single = [s['name'] for s in shops if len(s['listings']) == 1]
    print(f'{len(shops)} 家店，{n_dish} 道菜，其中 {n_img} 道有图；只在一个平台上架：{"、".join(single)}')
    for s in shops:
        def desc(l: dict) -> str:
            tiers = ','.join(f"{d['threshold']}-{d['off']}" for d in l['discounts'])
            return f"{l['platform'][:2]} {l['deliveryMin']}分 配送{l['deliveryFee']} {tiers} 缺{len(s['dishes']) - len(l['prices'])}"
        ls = ' / '.join(desc(l) for l in s['listings'])
        print(f"  {s['id']:<12}{s['name'][:10]:<11}{s['category']:<6}{len(s['dishes']):>3}道 {s['distanceKm']}km | {ls}")


if __name__ == '__main__':
    main()
