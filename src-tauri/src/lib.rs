use calamine::{open_workbook_auto, Data, Reader};
use serde::Serialize;
use serde_json::Value;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ParsedSheet {
    sheet_name: String,
    rows: Vec<Vec<Value>>,
}

fn cell_to_json(cell: &Data) -> Value {
    match cell {
        Data::Int(i) => Value::from(*i),
        Data::Float(f) => Value::from(*f),
        Data::String(s) => Value::from(s.clone()),
        Data::Bool(b) => Value::from(*b),
        Data::DateTime(dt) => Value::from(dt.as_f64()),
        Data::DateTimeIso(s) | Data::DurationIso(s) => Value::from(s.clone()),
        Data::Error(_) | Data::Empty => Value::Null,
    }
}

/// Parses the first sheet of an .xlsx/.xls/.ods file on the Rust side.
/// Large files (8MB+) hang or OOM when parsed with SheetJS in the WebView,
/// so all spreadsheet reading goes through calamine instead.
#[tauri::command]
fn parse_xlsx_backend(path: String) -> Result<ParsedSheet, String> {
    let mut workbook = open_workbook_auto(&path).map_err(|e| e.to_string())?;
    let sheet_name = workbook
        .sheet_names()
        .first()
        .cloned()
        .ok_or_else(|| "Workbook has no sheets".to_string())?;
    let range = workbook
        .worksheet_range(&sheet_name)
        .map_err(|e| e.to_string())?;

    let rows: Vec<Vec<Value>> = range
        .rows()
        .enumerate()
        .filter_map(|(i, row)| {
            let cells: Vec<Value> = row.iter().map(cell_to_json).collect();
            if i == 0 || cells.iter().any(|c| !c.is_null()) {
                Some(cells)
            } else {
                None
            }
        })
        .collect();

    Ok(ParsedSheet { sheet_name, rows })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn header_row(path: &str) -> Vec<Value> {
        parse_xlsx_backend(path.to_string())
            .expect("parse failed")
            .rows[0]
            .clone()
    }

    #[test]
    fn parses_shopee_existing_db() {
        let headers = header_row("../required/sample-existing-data/A. Marketplace Shopee 2026.xlsx");
        assert!(headers.contains(&Value::from("No. Pesanan")));
        assert!(headers.contains(&Value::from("Total Harga Produk")));
    }

    #[test]
    fn parses_shopee_export() {
        let headers = header_row("../required/sample-export-marketplace/sample export shopee.xlsx");
        assert!(headers.contains(&Value::from("No. Pesanan")));
        assert!(headers.contains(&Value::from("Subtotal Pesanan")));
    }

    #[test]
    fn parses_tiktok_existing_db() {
        let headers = header_row("../required/sample-existing-data/A. Marketplace Tiktok 2026.xlsx");
        assert!(headers.contains(&Value::from("Order ID")));
        assert!(headers.contains(&Value::from("Seller SKU")));
    }

    #[test]
    fn parses_tiktok_export() {
        let parsed =
            parse_xlsx_backend("../required/sample-export-marketplace/sample export Tiktok.xlsx".to_string())
                .expect("parse failed");
        assert!(parsed.rows[0].contains(&Value::from("Order ID")));
        assert!(parsed.rows[0].contains(&Value::from("Seller SKU")));
        // Data rows are present and shorter than the header-padded width is fine,
        // but at least one row should have content beyond Empty/null.
        assert!(parsed.rows.len() > 1);
        assert!(parsed.rows[1].iter().any(|c| !c.is_null()));
    }

    #[test]
    fn date_cells_in_tiktok_export_are_strings() {
        let parsed = parse_xlsx_backend(
            "../required/sample-export-marketplace/sample export Tiktok.xlsx".to_string(),
        )
        .expect("parse failed");
        let headers = &parsed.rows[0];
        let date_col = headers
            .iter()
            .position(|h| h == &Value::from("Created Time"))
            .expect("date column not found");
        let cell = &parsed.rows[1][date_col];
        assert!(cell.is_string(), "expected string-formatted date, got {cell:?}");
    }

    #[test]
    fn date_cells_in_existing_db_are_numeric_serials() {
        let parsed = parse_xlsx_backend(
            "../required/sample-existing-data/A. Marketplace Shopee 2026.xlsx".to_string(),
        )
        .expect("parse failed");
        let headers = &parsed.rows[0];
        let date_col = headers
            .iter()
            .position(|h| h == &Value::from("Waktu Pesanan Dibuat"))
            .expect("date column not found");
        let cell = &parsed.rows[1][date_col];
        assert!(cell.is_number(), "expected numeric serial date, got {cell:?}");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![parse_xlsx_backend])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
