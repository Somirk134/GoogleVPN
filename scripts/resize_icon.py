# -*- coding: utf-8 -*-
"""
图标尺寸调整脚本
从现有的 vpn.png 生成所需的各种尺寸
"""

import os
import sys

try:
    from PIL import Image
except ImportError:
    print("错误: 需要安装 Pillow 库")
    print("请在命令行运行: pip install Pillow")
    input("按回车键退出...")
    sys.exit(1)

# 源图标路径
SOURCE_ICON = r"C:\Users\Somirk\Desktop\googlevpn\extension\icons\vpn.png"

# 输出目录（相对于脚本位置）
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(os.path.dirname(SCRIPT_DIR), "extension", "icons")

# 需要的尺寸
SIZES = [16, 32, 48, 128]

def resize_icon():
    """调整图标尺寸"""
    
    # 检查源文件是否存在
    if not os.path.exists(SOURCE_ICON):
        print(f"错误: 找不到源图标文件")
        print(f"路径: {SOURCE_ICON}")
        print("\n请确认文件路径是否正确")
        input("按回车键退出...")
        return False
    
    # 确保输出目录存在
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    print("=" * 50)
    print("图标尺寸调整工具")
    print("=" * 50)
    print(f"\n源文件: {SOURCE_ICON}")
    print(f"输出目录: {OUTPUT_DIR}\n")
    
    try:
        # 打开源图标
        img = Image.open(SOURCE_ICON)
        print(f"✓ 成功打开源图标 (原始尺寸: {img.size[0]}x{img.size[1]})")
        
        # 转换为 RGBA 模式（支持透明）
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        
        # 生成各种尺寸
        for size in SIZES:
            # 调整尺寸（使用高质量重采样）
            resized = img.resize((size, size), Image.Resampling.LANCZOS)
            
            # 保存文件
            filename = f'icon{size}.png'
            filepath = os.path.join(OUTPUT_DIR, filename)
            resized.save(filepath, 'PNG')
            
            print(f"✓ 已生成: {filename} ({size}x{size})")
        
        print("\n" + "=" * 50)
        print("图标生成完成！")
        print("=" * 50)
        print(f"\n所有图标已保存到: {OUTPUT_DIR}")
        print("\n现在可以加载 Chrome Extension 了！")
        
        return True
        
    except Exception as e:
        print(f"\n错误: {str(e)}")
        return False

if __name__ == '__main__':
    success = resize_icon()
    input("\n按回车键退出...")
    sys.exit(0 if success else 1)
