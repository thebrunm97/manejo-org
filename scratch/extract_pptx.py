import zipfile
import xml.etree.ElementTree as ET
import os
import sys

def extract_pptx_text_and_notes(pptx_path, out_path):
    namespaces = {
        'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
        'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
        'p': 'http://schemas.openxmlformats.org/presentationml/2006/main'
    }

    slides_data = []

    try:
        with zipfile.ZipFile(pptx_path, 'r') as z:
            slide_files = [f for f in z.namelist() if f.startswith('ppt/slides/slide') and f.endswith('.xml') and 'Layout' not in f and 'Master' not in f]
            slide_files.sort(key=lambda x: int(x.split('ppt/slides/slide')[1].split('.xml')[0]))

            for i, slide_file in enumerate(slide_files, 1):
                slide_info = {'slide_number': i, 'text': [], 'notes': []}
                
                slide_xml = z.read(slide_file)
                root = ET.fromstring(slide_xml)
                for node in root.findall('.//a:t', namespaces):
                    if node.text:
                        slide_info['text'].append(node.text)

                rels_file = f"ppt/slides/_rels/slide{slide_file.split('slide')[1].split('.xml')[0]}.xml.rels"
                if rels_file in z.namelist():
                    rels_xml = z.read(rels_file)
                    rels_root = ET.fromstring(rels_xml)
                    notes_target = None
                    for rel in rels_root.findall('.//{http://schemas.openxmlformats.org/package/2006/relationships}Relationship'):
                        if 'notesSlide' in rel.attrib.get('Type', ''):
                            notes_target = rel.attrib.get('Target')
                            break
                    
                    if notes_target:
                        notes_file = os.path.normpath(os.path.join('ppt/slides', notes_target)).replace('\\', '/')
                        if notes_file in z.namelist():
                            notes_xml = z.read(notes_file)
                            notes_root = ET.fromstring(notes_xml)
                            for node in notes_root.findall('.//a:t', namespaces):
                                if node.text:
                                    slide_info['notes'].append(node.text)

                slides_data.append(slide_info)
        
        with open(out_path, 'w', encoding='utf-8') as f:
            for slide in slides_data:
                f.write(f"=== Slide {slide['slide_number']} ===\n")
                f.write("TEXT:\n")
                for t in slide['text']:
                    f.write(f"- {t}\n")
                f.write("\nNOTES:\n")
                for n in slide['notes']:
                    f.write(f"- {n}\n")
                f.write("\n" + "="*40 + "\n\n")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 2:
        extract_pptx_text_and_notes(sys.argv[1], sys.argv[2])
    else:
        print("Please provide a path to a pptx file and output file.")
