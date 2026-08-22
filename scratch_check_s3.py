import json
import glob
import sys

files = glob.glob('benchmark_results_*.json')
for f in files:
    with open(f, 'r', encoding='utf-8') as file:
        data = json.load(file)
        for run in data:
            if 'nemotron' in run.get('model', '') and run.get('scenario') == 'S3:ConsultaDRE':
                print(f"File: {f}")
                print(f"Latency: {run.get('latency_ms')} ms")
                print(f"Status: {run.get('status')}")
                if 'raw_response' in run:
                    print(f"Raw Response: {run['raw_response']}")
                if 'raw_text' in run:
                    print(f"Raw Text: {run['raw_text']}")
                print("-" * 40)
