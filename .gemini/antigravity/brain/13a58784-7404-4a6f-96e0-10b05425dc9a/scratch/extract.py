import zipfile
import xml.etree.ElementTree as ET
import os

def extract_docx(file_path, output_path):
    if not os.path.exists(file_path):
        print(f"Skipping {file_path}, not found.")
        return
    ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    doc = zipfile.ZipFile(file_path)
    xml_content = doc.read('word/document.xml')
    tree = ET.fromstring(xml_content)
    text = ''.join([node.text for node in tree.findall('.//w:t', ns) if node.text])
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(text)
    print(f"Extracted {file_path} to {output_path}")

extract_docx('EYES Level1 ProductSpec.docx', '.gemini/antigravity/brain/13a58784-7404-4a6f-96e0-10b05425dc9a/scratch/spec.txt')
extract_docx('EYES_Team_Vision_V2.docx', '.gemini/antigravity/brain/13a58784-7404-4a6f-96e0-10b05425dc9a/scratch/vision.txt')
