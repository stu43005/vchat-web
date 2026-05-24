import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import type { CurrencyAgg } from "../api/types";
import { formatCurrency } from "../lib/format";
import { currencyMap } from "../lib/currency";

interface CurrencyTableProps {
  currencies: CurrencyAgg[];
  jpyTotal: number;
}

export function CurrencyTable({ currencies, jpyTotal }: CurrencyTableProps) {
  return (
    <TableContainer sx={{ maxWidth: 480 }}>
      <Table
        size="small"
        sx={{ fontFamily: "monospace", "& td, & th": { fontFamily: "inherit" } }}
      >
        <TableHead>
          <TableRow>
            <TableCell>code</TableCell>
            <TableCell>symbol</TableCell>
            <TableCell align="right">sum</TableCell>
            <TableCell align="right">sum (JPY)</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {currencies.map((c) => (
            <TableRow key={c.currency}>
              <TableCell>{c.currency}</TableCell>
              <TableCell>{currencyMap[c.currency]?.symbol ?? c.currency}</TableCell>
              <TableCell align="right">
                {formatCurrency(c.amount, c.currency, "decimal")}
              </TableCell>
              <TableCell align="right">
                {formatCurrency(Math.round(c.jpyAmount), "JPY", "decimal")}
              </TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell />
            <TableCell />
            <TableCell />
            <TableCell align="right">
              <strong>{formatCurrency(jpyTotal, "JPY", "decimal")}</strong>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );
}
