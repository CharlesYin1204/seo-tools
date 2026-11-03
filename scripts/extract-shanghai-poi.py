#!/usr/bin/env python3
"""
从全国小区Excel表格中提取上海小区数据，清洗后导出为CSV
供Node.js导入脚本使用
"""
import openpyxl
import csv
import re
import sys

XLSX_PATH = '/www/wwwroot/expatshomenode/上海小区数据/全国小区数据excel表格.xlsx'
OUTPUT_CSV = '/www/wwwroot/expatshomenode/上海小区数据/shanghai_poi_cleaned.csv'

DISTRICT_MAP = {
    '浦东': '浦东新区', '浦东新区': '浦东新区',
    '静安': '静安区', '静安区': '静安区',
    '徐汇': '徐汇区', '徐汇区': '徐汇区',
    '闵行': '闵行区', '闵行区': '闵行区',
    '黄浦': '黄浦区', '黄浦区': '黄浦区',
    '虹口': '虹口区', '虹口区': '虹口区',
    '杨浦': '杨浦区', '杨浦区': '杨浦区',
    '松江': '松江区', '松江区': '松江区',
    '宝山': '宝山区', '宝山区': '宝山区',
    '嘉定': '嘉定区', '嘉定区': '嘉定区',
    '长宁': '长宁区', '长宁区': '长宁区',
    '普陀': '普陀区', '普陀区': '普陀区',
    '青浦': '青浦区', '青浦区': '青浦区',
    '奉贤': '奉贤区', '奉贤区': '奉贤区',
    '金山': '金山区', '金山区': '金山区',
    '崇明': '崇明区', '崇明区': '崇明区',
}

SKIP_AREAS = {'上海周边', '龙口市', '博山', '鲅鱼圈', '高淳区', '阆中', '寿县', '花桥', '利州', '海宁', '嘉善'}

def clean_value(val):
    """清洗字段值，'暂无数据'视为空"""
    if val is None:
        return ''
    s = str(val).strip()
    if s in ('暂无数据', '无', 'None', '0', ''):
        return ''
    return s

def extract_board(address_str):
    """从地址字符串中提取板块，格式: 区域-板块-详细地址"""
    if not address_str:
        return ''
    parts = address_str.split('-')
    if len(parts) >= 2:
        return parts[1].strip()
    return ''

def extract_detail_address(address_str):
    """从地址字符串中提取详细地址"""
    if not address_str:
        return ''
    parts = address_str.split('-')
    if len(parts) >= 3:
        return '-'.join(parts[2:]).strip()
    return address_str

def normalize_type(type_str):
    """标准化物业类型"""
    if not type_str:
        return '住宅'
    t = type_str.strip()
    if t in ('公寓',):
        return '公寓'
    if t in ('别墅',):
        return '别墅'
    if t in ('写字楼',):
        return '写字楼'
    if t in ('商铺',):
        return '商铺'
    return '住宅'

def parse_build_year(year_str):
    """提取建造年份数字"""
    if not year_str:
        return ''
    m = re.search(r'(\d{4})', str(year_str))
    return m.group(1) if m else ''

def parse_room_num(room_str):
    """提取总户数"""
    if not room_str:
        return ''
    m = re.search(r'(\d+)', str(room_str))
    return m.group(1) if m else ''

def main():
    print('正在打开Excel文件...')
    wb = openpyxl.load_workbook(XLSX_PATH, read_only=True)
    ws = wb[wb.sheetnames[0]]

    output_fields = [
        'community_name', 'district', 'board', 'address',
        'latitude', 'longitude', 'latitude_gps', 'longitude_gps',
        'property_type', 'build_year', 'total_units'
    ]

    total = 0
    exported = 0
    skipped_area = 0
    skipped_noname = 0
    seen_communities = set()
    duplicates = 0

    with open(OUTPUT_CSV, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=output_fields)
        writer.writeheader()

        for row in ws.iter_rows(min_row=3, max_col=21, values_only=True):
            total += 1
            city = row[2]
            if not city or '上海' not in str(city):
                continue

            area = clean_value(row[3])
            if area in SKIP_AREAS:
                skipped_area += 1
                continue

            district = DISTRICT_MAP.get(area, '')
            if not district:
                skipped_area += 1
                continue

            name = clean_value(row[0])
            if not name:
                skipped_noname += 1
                continue

            address_raw = clean_value(row[4])
            board = extract_board(address_raw)
            detail_address = extract_detail_address(address_raw)

            lat = clean_value(row[5])
            lng = clean_value(row[6])
            lat_gps = clean_value(row[7])
            lng_gps = clean_value(row[8])

            property_type = normalize_type(clean_value(row[9]))
            build_year = parse_build_year(clean_value(row[13]))
            total_units = parse_room_num(clean_value(row[12]))

            dedup_key = (name, district)
            if dedup_key in seen_communities:
                duplicates += 1
                continue
            seen_communities.add(dedup_key)

            writer.writerow({
                'community_name': name,
                'district': district,
                'board': board,
                'address': detail_address,
                'latitude': lat,
                'longitude': lng,
                'latitude_gps': lat_gps,
                'longitude_gps': lng_gps,
                'property_type': property_type,
                'build_year': build_year,
                'total_units': total_units,
            })
            exported += 1

            if exported % 2000 == 0:
                print(f'  已处理 {exported} 条...')

    wb.close()

    print(f'\n=== 导出完成 ===')
    print(f'全国总行数: {total}')
    print(f'上海数据导出: {exported} 条')
    print(f'跳过(非上海/周边): {skipped_area}')
    print(f'跳过(无名称): {skipped_noname}')
    print(f'去重: {duplicates}')
    print(f'输出文件: {OUTPUT_CSV}')

if __name__ == '__main__':
    main()
