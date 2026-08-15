from functools import wraps
from abc import ABC, abstractmethod


def path_stats(paths):
    """为存储路径列表生成 {path, exists, total, used, free, percent} 统计。"""
    import os
    try:
        import psutil
    except Exception:
        psutil = None
    out = []
    for p in (paths or []):
        item = {'path': p, 'exists': False, 'total': 0, 'used': 0, 'free': 0, 'percent': 0}
        try:
            if os.path.isdir(p):
                item['exists'] = True
                if psutil:
                    u = psutil.disk_usage(p)
                    item.update({'total': u.total, 'used': u.used,
                                 'free': u.free, 'percent': u.percent})
        except Exception:
            pass
        out.append(item)
    return out


class Plugin(ABC):
    name = ''
    label = ''
    icon = ''
    description = ''

    def __init__(self):
        self._routes = []
        self._register_routes()

    @abstractmethod
    def _register_routes(self):
        pass

    def route(self, path, methods=['GET']):
        def decorator(f):
            self._routes.append((path, methods, f))
            return f
        return decorator

    def dispatch(self, subpath, method):
        import json
        from flask import jsonify, request
        subpath = '/' + subpath if subpath else ''
        for path, methods, handler in self._routes:
            if subpath == path and method in methods:
                return handler()
        candidates = [r for r in self._routes
                      if r[0] and subpath.startswith(r[0]) and method in r[1]]
        if candidates:
            candidates.sort(key=lambda r: len(r[0]), reverse=True)
            return candidates[0][2]()
        return jsonify({'error': 'route not found'}), 404

    def get_info(self):
        return {
            'name': self.name,
            'label': self.label,
            'icon': self.icon,
            'description': self.description
        }

    # ------------------------------------------------------------------
    # 可插拔设置: 插件可覆写以向「设置页」注入配置项。
    # schema 元素: {key, label, type, value, options?, help?}
    #   type: text | number | select | switch
    # ------------------------------------------------------------------
    def get_setting_schema(self):
        return []

    def get_settings(self):
        return {s.get('key'): s.get('value') for s in self.get_setting_schema()}

    def save_settings(self, data):
        """默认不做持久化; 覆写以实现真实保存。返回 (ok, message)。"""
        return True, 'ok'


class PluginManager:
    def __init__(self):
        self._plugins = {}

    def register(self, plugin: Plugin):
        self._plugins[plugin.name] = plugin

    def remove(self, name):
        if name in self._plugins:
            del self._plugins[name]

    def get_plugin(self, name):
        return self._plugins.get(name)

    def list_plugins(self):
        return [p.get_info() for p in self._plugins.values()]

    def get_plugins(self):
        return dict(self._plugins)
