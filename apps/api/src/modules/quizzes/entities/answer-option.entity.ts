import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    Unique,
} from 'typeorm';

import { Answer } from './answer.entity.js';
import { Option } from './option.entity.js';

@Entity('answer_options')
@Unique('UQ_answer_option', [
    'answerId',
    'optionId',
])
export class AnswerOption {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({
        name: 'answer_id',
        type: 'uuid',
    })
    answerId: string;

    @ManyToOne(() => Answer, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({
        name: 'answer_id',
    })
    answer: Answer;

    @Column({
        name: 'option_id',
        type: 'uuid',
    })
    optionId: string;

    @ManyToOne(() => Option, {
        onDelete: 'RESTRICT',
    })
    @JoinColumn({
        name: 'option_id',
    })
    option: Option;

    @CreateDateColumn({
        name: 'created_at',
    })
    createdAt: Date;
}