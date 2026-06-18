"""Damz Agent — Tool Registry.

Registers all available tools for the LangChain agent.
"""

try:
    from tools.system_tools import (
        get_current_time,
        open_application,
        get_system_info,
        take_screenshot,
        set_reminder,
    )
    from tools.web_tools import search_web, open_url

    ALL_TOOLS = [
        get_current_time,
        open_application,
        get_system_info,
        take_screenshot,
        set_reminder,
        search_web,
        open_url,
    ]

    # GarmentMind tools — uncomment when GarmentMind API is ready
    # from tools.garmentmind_tools import (
    #     cek_status_produksi, cek_absensi_hari_ini, laporan_harian
    # )
    # ALL_TOOLS.extend([cek_status_produksi, cek_absensi_hari_ini, laporan_harian])

    print(f"[TOOLS] Registered {len(ALL_TOOLS)} tools")

except ImportError as e:
    print(f"[TOOLS] Warning: Could not load tools: {e}")
    ALL_TOOLS = []
