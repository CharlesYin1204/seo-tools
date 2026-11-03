-- 为房源采集任务表添加起始页和结束页字段
-- 执行日期：2025-10-14
-- 功能：支持从第N页到第M页的采集设置

-- 检查并添加start_page字段
ALTER TABLE property_scraper_tasks 
ADD COLUMN IF NOT EXISTS start_page INT DEFAULT 1 COMMENT '采集起始页码' AFTER max_pages;

-- 检查并添加end_page字段
ALTER TABLE property_scraper_tasks 
ADD COLUMN IF NOT EXISTS end_page INT DEFAULT 1 COMMENT '采集结束页码' AFTER start_page;

-- 更新已有数据：将max_pages转换为end_page
UPDATE property_scraper_tasks 
SET start_page = 1, 
    end_page = max_pages 
WHERE start_page IS NULL OR end_page IS NULL;

-- 查看表结构确认
DESC property_scraper_tasks;


