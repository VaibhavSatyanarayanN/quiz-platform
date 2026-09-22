import React from 'react';
import styles from './Table.module.css';

export const TableContainer: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...rest
}) => (
  <div className={`${styles.container} ${className}`} {...rest}>
    {children}
  </div>
);

export const Table: React.FC<React.TableHTMLAttributes<HTMLTableElement>> = ({
  children,
  className = '',
  ...rest
}) => (
  <table className={`${styles.table} ${className}`} {...rest}>
    {children}
  </table>
);

export const Thead: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  children,
  className = '',
  ...rest
}) => (
  <thead className={className} {...rest}>
    {children}
  </thead>
);

export const Tbody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  children,
  className = '',
  ...rest
}) => (
  <tbody className={className} {...rest}>
    {children}
  </tbody>
);

export const Tr: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({
  children,
  className = '',
  ...rest
}) => (
  <tr className={`${styles.tr} ${className}`} {...rest}>
    {children}
  </tr>
);

export const Th: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({
  children,
  className = '',
  ...rest
}) => (
  <th className={`${styles.th} ${className}`} {...rest}>
    {children}
  </th>
);

export const Td: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({
  children,
  className = '',
  ...rest
}) => (
  <td className={`${styles.td} ${className}`} {...rest}>
    {children}
  </td>
);
