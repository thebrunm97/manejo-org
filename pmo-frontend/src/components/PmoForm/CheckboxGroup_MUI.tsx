// src/components/PmoForm/CheckboxGroup_MUI.tsx

import React, { ChangeEvent } from 'react';
import {
    FormControl,
    FormLabel,
    FormGroup,
    FormControlLabel,
    Checkbox,
    Grid,
    TextField,
    Typography
} from '@mui/material';

interface CheckboxGroupMUIProps {
    title: string;
    options: string[];
    selectedString: string | null | undefined;
    onSelectionChange: (value: string) => void;
    otherOption?: string;
    otherValue?: string;
    onOtherChange?: (e: ChangeEvent<HTMLInputElement>) => void;
    otherName?: string;
    otherPlaceholder?: string;
}

const CheckboxGroupMUI: React.FC<CheckboxGroupMUIProps> = ({
    title,
    options,
    selectedString,
    onSelectionChange,
    otherOption,
    otherValue,
    onOtherChange,
    otherName,
    otherPlaceholder = "Por favor, especifique..."
}) => {
    const guaranteedString = String(selectedString ?? '');
    const selectedOptions = guaranteedString.split('; ').filter(Boolean);

    const handleCheckboxChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { value, checked } = e.target;
        let newSelected = [...selectedOptions];

        if (checked && !newSelected.includes(value)) {
            newSelected.push(value);
        } else {
            newSelected = newSelected.filter(option => option !== value);
        }

        onSelectionChange(newSelected.join('; '));
    };

    const isOtherSelected = otherOption && selectedOptions.includes(otherOption);

    return (
        <FormControl component="fieldset" fullWidth margin="normal">
            <FormLabel component="legend">
                <Typography variant="h6">{title}</Typography>
            </FormLabel>

            <FormGroup>
                <Grid container>
                    {options.map((option) => (
                        <Grid item xs={12} sm={6} key={option}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        value={option}
                                        checked={selectedOptions.includes(option)}
                                        onChange={handleCheckboxChange}
                                    />
                                }
                                label={option}
                            />
                        </Grid>
                    ))}
                </Grid>
            </FormGroup>

            {isOtherSelected && (
                <TextField
                    name={otherName}
                    label={otherPlaceholder}
                    value={otherValue || ''}
                    onChange={onOtherChange}
                    variant="outlined"
                    fullWidth
                    multiline
                    rows={2}
                    margin="normal"
                />
            )}
        </FormControl>
    );
};

export default CheckboxGroupMUI;
