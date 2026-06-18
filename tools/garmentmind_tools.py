"""Damz Agent — GarmentMind Integration Tools.

Optional tools for connecting to GarmentMind production monitoring
and HIRIS attendance system. Activate when API is ready.
"""

import requests

try:
    from langchain.tools import tool
except ImportError:
    def tool(func):
        func.is_tool = True
        return func


GARMENTMIND_URL = "http://localhost:8000"


@tool
def cek_status_produksi(dummy: str = "") -> str:
    """Cek status produksi terkini dari GarmentMind."""
    try:
        r = requests.get(f"{GARMENTMIND_URL}/api/production/status", timeout=5)
        data = r.json()
        return f"Produksi: {data.get('summary', 'tidak ada data')}"
    except requests.exceptions.ConnectionError:
        return "GarmentMind tidak dapat dijangkau. Pastikan server berjalan."
    except Exception as e:
        return f"Error: {e}"


@tool
def cek_absensi_hari_ini(dummy: str = "") -> str:
    """Cek data absensi hari ini dari HIRIS."""
    try:
        r = requests.get(f"{GARMENTMIND_URL}/api/attendance/today", timeout=5)
        data = r.json()
        return (
            f"Absensi hari ini: {data.get('present', 0)} hadir, "
            f"{data.get('absent', 0)} tidak hadir dari {data.get('total', 0)} karyawan."
        )
    except requests.exceptions.ConnectionError:
        return "HIRIS tidak dapat dijangkau."
    except Exception as e:
        return f"Error: {e}"


@tool
def laporan_harian(dummy: str = "") -> str:
    """Buat ringkasan laporan operasional harian GarmentMind."""
    try:
        r = requests.get(f"{GARMENTMIND_URL}/api/reports/daily", timeout=5)
        data = r.json()
        return data.get("summary", "Tidak ada laporan hari ini.")
    except requests.exceptions.ConnectionError:
        return "Gagal mengambil laporan harian."
    except Exception as e:
        return f"Error: {e}"
