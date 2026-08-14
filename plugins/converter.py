import os
import re
import shutil
import zipfile

PLUGIN_TEMPLATE = '''import os
import json
from flask import jsonify, request, send_file
from plugins.base import Plugin


class {class_name}(Plugin):
    name = '{plugin_name}'
    label = '''"'''{plugin_label}'''"'''
    icon = ''
    description = '''"'''{description}'''"'''

    def _register_routes(self):
        @self.route('/info', methods=['GET'])
        def plugin_info():
            return jsonify({{
                'name': self.name,
                'label': self.label,
                'description': self.description,
                'version': '{version}',
                'author': '{author}',
                'commands': {commands_json},
                'api_urls': {api_urls_json}
            }})

        @self.route('/icon', methods=['GET'])
        def plugin_icon():
            icon_path = os.path.join(os.path.dirname(__file__), 'images', 'icon.png')
            if os.path.isfile(icon_path):
                return send_file(icon_path, mimetype='image/png')
            return jsonify({{'error': 'no icon'}}), 404
'''


def convert_java_plugin(zip_path, extract_dir, plugin_name):
    plugin_dir = os.path.join(extract_dir, plugin_name)

    # Read info.prop
    info = {'name': plugin_name, 'version': '1.0', 'author': 'unknown', 'description': ''}
    info_path = os.path.join(plugin_dir, 'info.prop')
    if os.path.isfile(info_path):
        raw = open(info_path, 'rb').read()
        ip_text = None
        for enc in ['utf-8', 'utf-8-sig', 'gb18030', 'gbk']:
            try:
                ip_text = raw.decode(enc)
                break
            except:
                continue
        if ip_text is None:
            ip_text = raw.decode('utf-8', errors='replace')
        for line in ip_text.split('\n'):
            line = line.strip()
            if '=' in line:
                k, v = line.split('=', 1)
                info[k.strip().lower()] = v.strip()

    # Read main.java for commands and APIs
    java_path = os.path.join(plugin_dir, 'main.java')
    commands = []
    api_urls = []
    if os.path.isfile(java_path):
        raw = open(java_path, 'rb').read()
        text = None
        for enc in ['utf-8', 'gb18030', 'gbk']:
            try:
                text = raw.decode(enc)
                break
            except:
                continue
        if text is None:
            text = raw.decode('utf-8', errors='replace')

        for line in text.split('\n'):
            for m in re.finditer(r'"([^"]*?/[^"\n]+?)"', line):
                cmd = m.group(1).strip()
                if cmd.startswith('/') and cmd not in commands and '<' not in cmd and '\\n' not in cmd and not cmd.startswith('/cache'):
                    commands.append(cmd)
            for m in re.finditer(r'(https?://[^\s"\'\\,)\]>]+)', line):
                url = m.group(1).rstrip('/')
                if url not in api_urls:
                    api_urls.append(url)

    # Generate plugin.py
    plugin_label = info.get('name', plugin_name)
    description = info.get('description', '')
    if not description:
        description = f'{plugin_label} - AstrBot Java plugin'

    version = info.get('version', '1.0')
    author = info.get('author', 'unknown')

    # Derive a clean plugin name
    raw_name = plugin_name or plugin_label or ''
    clean_name = re.sub(r'[^a-zA-Z0-9]', '_', raw_name)

    class_name = ''.join(w.capitalize() for w in re.split(r'[_\s\-]+', clean_name) if w)
    if not class_name:
        class_name = 'GeneratedPlugin'
    clean_name = re.sub(r'_+', '_', clean_name).strip('_').lower()[:30]
    if not clean_name:
        import hashlib
        suffix = hashlib.md5(plugin_name.encode('utf-8')).hexdigest()[:8]
        clean_name = f'plugin_{suffix}'
    plugins_dir = os.path.join(os.path.dirname(__file__))
    if os.path.isdir(os.path.join(plugins_dir, clean_name)):
        clean_name = clean_name + '_converted'

    py_content = PLUGIN_TEMPLATE.format(
        class_name=class_name,
        plugin_name=clean_name,
        plugin_label=plugin_label,
        description=description,
        version=version,
        author=author,
        commands_json=str(commands),
        api_urls_json=str(api_urls)
    )

    py_path = os.path.join(plugin_dir, 'plugin.py')
    with open(py_path, 'w', encoding='utf-8') as f:
        f.write(py_content)

    # Ensure __init__.py exists
    init_path = os.path.join(plugin_dir, '__init__.py')
    if not os.path.isfile(init_path):
        with open(init_path, 'w') as f:
            f.write('')

    return {
        'name': info['name'],
        'label': plugin_label,
        'version': version,
        'author': author,
        'description': description,
        'commands': commands,
        'api_urls': api_urls
    }


def is_java_plugin(extract_dir):
    for root, dirs, files in os.walk(extract_dir):
        if 'main.java' in files:
            return True
        if 'info.prop' in files:
            return True
    return False
