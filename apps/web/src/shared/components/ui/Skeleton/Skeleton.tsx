import React from 'react';
import styles from './Skeleton.module.css';

export interface SkeletonProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  width,
  height,
  style,
  className = '',
  ...rest
}) => {
  return (
    <span
      className={`${styles.skeleton} ${styles[variant]} ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        ...style,
      }}
      aria-hidden="true"
      {...rest}
    />
  );
};
