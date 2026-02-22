#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
图标尺寸调整工具
从 vpn.png 生成 4 个不同尺寸的图标
"""

import os
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("错误: 未安装 Pillow 库")
    print("请运行: pip install Pillow")
    sys.exit(1)

def resize_icon():
    """从 vpn.png 生成 4 个不同尺寸的图标"""
    
    # 获取项目根目录
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    icon_dir = project_root / "extension" / "icons"
    
    # 源图标路径
    source_icon = icon_dir / "vpn.png"
    
    # 检查源文件是否存在
    if not source_icon.exists():
        print(f"错误: 找不到源图标文件")
        print(f"期望路径: {source_icon}")
        print()
        print("请确保 vpn.png 文件在 extension/icons/ 目录下")
        return False
    
    print(f"✓ 找到源图标: {source_icon}")
    print()
    
    # 需要生成的尺寸
    sizes = [16, 32, 48, 128]
    
    try:
        # 打开源图标
        img = Image.open(source_icon)
        print(f"源图标尺寸: {img.size}")
        print()
        
        # 生成各个尺寸
        for size in sizes:
            output_path = icon_dir / f"icon{size}.png"
            
            # 调整尺寸（使用高质量重采样）
            resized = img.resize((size, size), Image.Resampling.LANCZOS)
            
            # 保存
            resized.save(output_path, "PNG")
            print(f"✓ 生成 icon{size}.png")
        
        print()
        print("========================================")
        print("所有图标生成成功！")
        print("========================================")
        return True
        
    except Exception as e:
        print(f"错误: {e}")
        return False

if __name__ == "__main__":
    success = resize_icon()
    sys.exit(0 if success else 1)
