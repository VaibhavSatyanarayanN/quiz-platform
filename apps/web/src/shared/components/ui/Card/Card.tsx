import React from 'react';
import styles from './Card.module.css';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'outlined' | 'interactive';
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  variant = 'default',
  ...rest
}) => {
  return (
    <div
      className={`${styles.card} ${styles[variant]} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...rest
}) => (
  <div className={`${styles.header} ${className}`} {...rest}>
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  children,
  className = '',
  ...rest
}) => (
  <h3 className={`${styles.title} ${className}`} {...rest}>
    {children}
  </h3>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  children,
  className = '',
  ...rest
}) => (
  <p className={`${styles.description} ${className}`} {...rest}>
    {children}
  </p>
);

export const CardBody: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...rest
}) => (
  <div className={`${styles.body} ${className}`} {...rest}>
    {children}
  </div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...rest
}) => (
  <div className={`${styles.footer} ${className}`} {...rest}>
    {children}
  </div>
);
