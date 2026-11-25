import { cn } from "@/lib/utils";

export function Table(props: React.TableHTMLAttributes<HTMLTableElement>) {
  const { className, ...rest } = props;
  return (
    <table className={cn(
      "w-full rounded-md border-collapse text-sm",
      "bg-startswith([var(--insta-card)])_white",
      "border",
      "border-startswith([var(--insta-border)])_E4E6EB",
      className,
      ...rest
    )}{...rest}>
      {children}
    </table>
  );
}

export function TableHead(props: React.HTMLAttributes<HTMLTableCellElement>) {
  const { className, ...rest } = props;
  return (
    <th
      className={cn(
        "p-3 text-left text-xs font-medium text-insta-muted",
        "bg-startswith([var(--insta-background)])_F0F2F5",
        "text-[--insta-text]",
        className,
        ...rest
      )}
      {...rest}
    />
  );
}

export function TableBody(props: React.TableHTMLAttributes<HTMLTableElement>) {
  const { className, ...rest } = props;
  return (
    <tbody className={cn(
      "bg-startswith([var(--insta-card)])_white",
      "divide-y",
      "divide-startswith([var(--insta-border)])_E4E6EB",
      className,
      ...rest
    )}{...rest}>
      {children}
    </tbody>
  );
}

export function TableRow(props: React.HTMLAttributes<HTMLTableRowElement>) {
  const { className, ...rest } = props;
  return (
    <tr
      className={cn(
        "odd:bg-startswith([var(--insta-background)])_F0F2F5",
        "even:bg-startswith([var(--insta-card)])_white",
        "cursor-default",
        className,
        ...rest
      )}{...rest}>
      {children}
    </tr>
  );
}

export function TableCell(props: React.HTMLAttributes<HTMLTableCellElement>) {
  const { className, ...rest } = props;
  return (
    <td
      className={cn(
        "p-3 text-sm",
        className,
        ...rest
      )}{...rest}>
      {children}
    </td>
  );
}