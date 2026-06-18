"""Damz Agent — System Tools.

Tools for system control: time, app launcher, system monitor,
screenshot, and reminders.
"""

import datetime
import os
import threading
import time
from pathlib import Path

try:
    from langchain.tools import tool
except ImportError:
    def tool(func):
        func.is_tool = True
        return func


@tool
def get_current_time(dummy: str = "") -> str:
    """Dapatkan waktu dan tanggal saat ini."""
    now = datetime.datetime.now()
    return now.strftime("Sekarang hari %A, %d %B %Y, pukul %H:%M:%S")


@tool
def open_application(app_name: str) -> str:
    """
    Buka aplikasi Windows.
    Contoh: notepad, chrome, vscode, calculator, explorer, word, excel
    """
    APP_MAP = {
        "notepad": "notepad.exe",
        "kalkulator": "calc.exe",
        "calculator": "calc.exe",
        "explorer": "explorer.exe",
        "chrome": r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        "vscode": r"%LOCALAPPDATA%\Programs\Microsoft VS Code\Code.exe",
        "paint": "mspaint.exe",
        "cmd": "cmd.exe",
        "powershell": "powershell.exe",
        "word": r"C:\Program Files\Microsoft Office\root\Office16\WINWORD.EXE",
        "excel": r"C:\Program Files\Microsoft Office\root\Office16\EXCEL.EXE",
        "task manager": "taskmgr.exe",
    }

    exe = APP_MAP.get(app_name.lower())
    if exe:
        try:
            os.startfile(os.path.expandvars(exe))
            return f"Berhasil membuka {app_name}."
        except Exception as e:
            return f"Gagal membuka {app_name}: {e}"
    return f"Aplikasi '{app_name}' tidak ditemukan. Yang tersedia: {', '.join(APP_MAP.keys())}"


@tool
def get_system_info(dummy: str = "") -> str:
    """Cek status sistem: CPU, RAM, Disk."""
    try:
        import psutil
        cpu = psutil.cpu_percent(interval=1)
        ram = psutil.virtual_memory()
        disk = psutil.disk_usage("C:/")
        return (
            f"CPU: {cpu}% | "
            f"RAM: {ram.used // (1024**3)}GB/{ram.total // (1024**3)}GB ({ram.percent}%) | "
            f"Disk C: {disk.used // (1024**3)}GB/{disk.total // (1024**3)}GB ({disk.percent}%)"
        )
    except ImportError:
        return "psutil not installed. Run: pip install psutil"


@tool
def take_screenshot(filename: str = "") -> str:
    """Ambil screenshot layar, simpan ke folder screenshots."""
    try:
        import pyautogui
        screenshot_dir = Path(__file__).parent.parent / "data" / "screenshots"
        screenshot_dir.mkdir(parents=True, exist_ok=True)

        name = filename or f"screenshot_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        path = screenshot_dir / name
        pyautogui.screenshot(str(path))
        return f"Screenshot disimpan: {path}"
    except ImportError:
        return "pyautogui not installed. Run: pip install pyautogui"
    except Exception as e:
        return f"Gagal mengambil screenshot: {e}"


@tool
def set_reminder(input_str: str) -> str:
    """
    Set pengingat. Format: 'pesan|menit'
    Contoh: 'meeting zoom|30' akan mengingatkan dalam 30 menit.
    """
    try:
        parts = input_str.split("|")
        message = parts[0].strip()
        minutes = int(parts[1].strip()) if len(parts) > 1 else 5

        def remind():
            time.sleep(minutes * 60)
            try:
                import ctypes
                ctypes.windll.user32.MessageBoxW(0, message, "Pengingat Damz", 0x40)
            except Exception:
                print(f"\n[REMINDER] {message}")

        threading.Thread(target=remind, daemon=True).start()
        return f"Pengingat '{message}' diset {minutes} menit lagi."
    except Exception as e:
        return f"Gagal set pengingat: {e}. Format: 'pesan|menit'"
